<?php

/**
 * auth/logout.php — выход: отзывает refresh-токен из cookie и чистит cookie.
 * Access-токен доживает свои 15 минут, но без refresh сессию не продлить.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/auth_helper.php';

cors();
method('POST');

revokeRefreshCookie();

json_out(['logged_out' => true]);
