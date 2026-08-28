<?php

/**
 * search_api.php — клиент Yandex Search API.
 *
 * Источники:
 *   - Wordstat: POST /v2/wordstat/topRequests
 *   - Веб-поиск: POST /v2/web/search
 *
 * Авторизация:
 *   - API-ключ сервисного аккаунта: Authorization: Api-Key <ключ>
 *   - или IAM-токен: Authorization: Bearer <IAM-токен>
 *
 * Все секреты читаются из .env, в коде ключей нет.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Базовый URL Yandex Search API. */
function searchApiBaseUrl(): string
{
    return env('YANDEX_SEARCH_API_BASE_URL', 'https://searchapi.api.cloud.yandex.net');
}

/**
 * Единый POST-запрос к Search API.
 *
 * @param string $path   путь без базового URL, например /v2/wordstat/topRequests
 * @param array  $payload тело запроса
 * @return array разобранный JSON-ответ
 * @throws RuntimeException при сетевых/API-ошибках или отсутствии настроек
 */
function searchApiRequest(string $path, array $payload): array
{
    $iamToken = env('YANDEX_SEARCH_IAM_TOKEN');
    $apiKey   = env('YANDEX_SEARCH_API_KEY');
    $folderId = env('YC_FOLDER_ID');

    if (!$iamToken && !$apiKey) {
        throw new RuntimeException(
            'Yandex Search API не настроен: добавьте YANDEX_SEARCH_API_KEY или YANDEX_SEARCH_IAM_TOKEN в .env'
        );
    }
    if (!$folderId) {
        throw new RuntimeException('Yandex Search API не настроен: заполните YC_FOLDER_ID в .env');
    }

    // folderId подставляем один раз, если вызывающий код не передал явно
    if (!isset($payload['folderId'])) {
        $payload['folderId'] = $folderId;
    }

    $authHeader = $iamToken
        ? 'Bearer ' . $iamToken
        : 'Api-Key ' . $apiKey;

    $url  = searchApiBaseUrl() . $path;
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_POSTFIELDS     => $json,
        CURLOPT_HTTPHEADER     => [
            'Authorization: ' . $authHeader,
            'Content-Type: application/json',
        ],
    ]);

    $raw    = curl_exec($ch);
    $code   = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Сетевая ошибка Search API: ' . $curlErr);
    }

    $data = json_decode((string) $raw, true);

    if ($code < 200 || $code >= 300) {
        $message = is_array($data)
            ? ($data['message'] ?? ($data['error'] ?? (string) $raw))
            : (string) $raw;
        throw new RuntimeException('Search API HTTP ' . $code . ': ' . $message);
    }

    if (!is_array($data)) {
        throw new RuntimeException('Search API вернул некорректный JSON');
    }

    return $data;
}

/**
 * Wordstat: популярные запросы по фразе (GetTop).
 *
 * @param string $phrase      ключевая фраза (поддерживает поисковые операторы)
 * @param int    $numPhrases  количество фраз в ответе, максимум 2000
 * @param array  $regions     регионы, по умолчанию 225 — Россия
 * @param array  $devices     устройства, по умолчанию DEVICE_ALL
 * @return array нормализованный ответ: totalCount, results, associations
 */
function searchApiWordstatTop(
    string $phrase,
    int $numPhrases = 100,
    array $regions = ['225'],
    array $devices = ['DEVICE_ALL']
): array {
    $phrase = trim($phrase);
    if ($phrase === '') {
        throw new RuntimeException('Wordstat: пустая ключевая фраза');
    }

    if ($numPhrases < 1) {
        $numPhrases = 50;
    }
    if ($numPhrases > 2000) {
        $numPhrases = 2000;
    }

    $raw = searchApiRequest('/v2/wordstat/topRequests', [
        'phrase'     => $phrase,
        'numPhrases' => $numPhrases,
        'regions'    => $regions,
        'devices'    => $devices,
    ]);

    $normalize = fn($item) => is_array($item) ? [
        'phrase' => (string) ($item['phrase'] ?? ''),
        'count'  => (int) ($item['count'] ?? 0),
    ] : ['phrase' => '', 'count' => 0];

    return [
        'totalCount'  => (int) ($raw['totalCount'] ?? 0),
        'results'     => array_values(array_map($normalize, (array) ($raw['results'] ?? []))),
        'associations'=> array_values(array_map($normalize, (array) ($raw['associations'] ?? []))),
    ];
}

/**
 * Веб-поиск Search API.
 *
 * Возвращает «сырую» поисковую выдачу в выбранном формате.
 * Для парсинга конкурентов удобнее FORMAT_XML: стабильно разбирается SimpleXML.
 *
 * @param string $query          текст запроса
 * @param string $responseFormat FORMAT_XML | FORMAT_HTML
 * @return string содержимое rawData после base64-декодирования
 */
function searchApiWeb(string $query, string $responseFormat = 'FORMAT_XML'): string
{
    $query = trim($query);
    if ($query === '') {
        throw new RuntimeException('Web Search: пустой поисковый запрос');
    }

    $supported = ['FORMAT_XML', 'FORMAT_HTML'];
    if (!in_array($responseFormat, $supported, true)) {
        $responseFormat = 'FORMAT_XML';
    }

    $raw = searchApiRequest('/v2/web/search', [
        'query' => [
            'searchType' => 'SEARCH_TYPE_RU',
            'queryText'  => $query,
        ],
        'responseFormat' => $responseFormat,
    ]);

    $rawData = (string) ($raw['rawData'] ?? '');
    if ($rawData === '') {
        throw new RuntimeException('Web Search: пустой rawData в ответе Search API');
    }

    $decoded = base64_decode($rawData, true);
    if ($decoded === false) {
        throw new RuntimeException('Web Search: не удалось декодировать rawData из base64');
    }

    return $decoded;
}

/**
 * Веб-поиск с разбором XML-выдачи в структурированные документы.
 *
 * Возвращает массив:
 * [
 *   ['url' => string, 'domain' => string, 'title' => string, 'snippet' => string],
 *   ...
 * ]
 *
 * @param string $query поисковый запрос
 * @param int    $limit максимальное количество документов
 */
function searchApiWebDocs(string $query, int $limit = 10): array
{
    $xml = searchApiWeb($query, 'FORMAT_XML');
    return parseSearchApiDocsFromXml($xml, $limit);
}

/**
 * Разбирает XML-выдачу Search API в массив документов.
 *
 * Структура Яндекса: элементы <doc> с <url>, <title>, <headline>,
 * <passages><passage>. Используем DOMXPath + local-name(), чтобы
 * не зависеть от возможных namespace-префиксов.
 */
function parseSearchApiDocsFromXml(string $xml, int $limit = 10): array
{
    if ($limit < 1) {
        $limit = 10;
    }

    $prev = libxml_use_internal_errors(true);
    $dom  = new DOMDocument();
    $ok   = $dom->loadXML($xml, LIBXML_NOCDATA | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    if (!$ok) {
        throw new RuntimeException('Web Search: не удалось разобрать XML-выдачу');
    }

    $xpath = new DOMXPath($dom);
    $docs  = [];

    foreach ($xpath->query('//*[local-name()="doc"]') as $docNode) {
        if (count($docs) >= $limit) {
            break;
        }

        $url = trim((string) $xpath->evaluate('string(.//*[local-name()="url"])', $docNode));
        if ($url === '' || strpos($url, 'http') !== 0) {
            continue;
        }

        $title = trim((string) $xpath->evaluate('string(.//*[local-name()="title"])', $docNode));

        $snippet = '';
        foreach ($xpath->query('.//*[local-name()="passage"]', $docNode) as $p) {
            $snippet .= trim((string) $p->textContent) . ' ';
        }
        // Фолбэк: если passages нет, берём headline
        if ($snippet === '') {
            $snippet = trim((string) $xpath->evaluate('string(.//*[local-name()="headline"])', $docNode));
        }

        $docs[] = [
            'url'     => $url,
            'domain'  => parseDomain($url),
            'title'   => $title,
            'snippet' => trim($snippet),
        ];
    }

    return $docs;
}

/** Достаёт домен второго уровня из URL. */
function parseDomain(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        return '';
    }
    return strtolower($host);
}