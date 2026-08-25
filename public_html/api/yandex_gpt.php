<?php

/**
 * yandex_gpt.php — интеграция с YandexGPT (Yandex Cloud, foundationModels v1).
 * Авторизация: API-ключ сервисного аккаунта (роль ai.languageModels.user)
 * передаётся заголовком `Authorization: Api-Key <ключ>`; каталог — в modelUri.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Синхронный запрос к YandexGPT.
 *
 * @param string $prompt      текст запроса
 * @param float  $temperature 0.0–1.0 (ниже — детерминированнее)
 * @param int    $maxTokens   лимит токенов ответа
 * @return string текст ответа модели
 * @throws RuntimeException — при ошибках конфигурации, сети или API
 */
function callYandexGPT(string $prompt, float $temperature = 0.3, int $maxTokens = 1024): string
{
    $apiKey = env('YANDEX_GPT_API_KEY');
    $folder = env('YC_FOLDER_ID');
    if ($apiKey === null || $folder === null) {
        throw new RuntimeException('YandexGPT не настроен: заполните YC_FOLDER_ID и YANDEX_GPT_API_KEY в .env');
    }

    $payload = [
        'modelUri' => 'gpt://' . $folder . '/' . env('YC_MODEL', 'yandexgpt/latest'),
        'completionOptions' => [
            'stream'      => false,
            'temperature' => $temperature,
            'maxTokens'   => (string) $maxTokens,
        ],
        'messages' => [
            ['role' => 'user', 'text' => $prompt],
        ],
    ];

    $ch = curl_init('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Api-Key ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);

    $raw    = curl_exec($ch);
    $code   = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlEr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Сетевая ошибка YandexGPT: ' . $curlEr);
    }

    $data = json_decode((string) $raw, true);
    if ($code !== 200) {
        $message = is_array($data) ? ($data['message'] ?? (string) $raw) : (string) $raw;
        throw new RuntimeException('YandexGPT HTTP ' . $code . ': ' . $message);
    }

    $text = $data['result']['alternatives'][0]['message']['text'] ?? null;
    if (!is_string($text) || trim($text) === '') {
        throw new RuntimeException('YandexGPT вернул пустой ответ');
    }

    return trim($text);
}

/**
 * Собирает промпт для краткого брифа по ответам распаковки.
 *
 * @param array $answers массив ['key' => ..., 'label' => ..., 'value' => ...]
 */
function buildBriefPrompt(array $answers): string
{
    $lines = [];
    foreach ($answers as $a) {
        if (!is_array($a) || !isset($a['value'])) {
            continue;
        }
        $label = (string) ($a['label'] ?? $a['key'] ?? 'Вопрос');
        $lines[] = '- ' . $label . ': ' . (string) $a['value'];
    }

    return "Ты — опытный продюсер онлайн-курсов. По ответам эксперта на распаковке составь "
        . "краткий бриф запуска (5–7 предложений): сильные стороны эксперта, целевая аудитория, "
        . "главная боль, обещание продукта, точки роста и риск. Без воды, по делу.\n\n"
        . implode("\n", $lines);
}
