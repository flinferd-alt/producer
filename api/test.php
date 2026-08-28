<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/yandex_gpt.php';

echo "Отправляем запрос к YandexGPT...<br><br>";

try {
    // Делаем простой тестовый запрос к нейросети
    $result = callYandexGPT("Привет! Напиши одно предложение: 'Интеграция работает отлично!'", 0.5, 50);
    echo "✅ Ответ YandexGPT: <br><br><b>" . htmlspecialchars($result) . "</b>";
} catch (Throwable $e) {
    echo "❌ Ошибка интеграции: " . $e->getMessage();
}