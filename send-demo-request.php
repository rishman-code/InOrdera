<?php
declare(strict_types=1);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

function clean_field(string $value): string {
    return trim(str_replace(["\r", "\n"], '', $value));
}

// Honeypot — bots that fill this hidden field get a fake success, no email sent.
if (clean_field($_POST['bot-field'] ?? '') !== '') {
    echo json_encode(['success' => true]);
    exit;
}

$firstName      = clean_field($_POST['first_name'] ?? '');
$lastName       = clean_field($_POST['last_name'] ?? '');
$email          = clean_field($_POST['email'] ?? '');
$restaurantName = clean_field($_POST['restaurant_name'] ?? '');
$phone          = clean_field($_POST['phone'] ?? '');
$locations      = clean_field($_POST['locations'] ?? '');

if ($firstName === '' || $lastName === '' || $email === '' || $restaurantName === '' || $phone === '' || $locations === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

$to = 'rishi.shinn@hotmail.co.uk';
$subject = 'New demo request: ' . $restaurantName;

$body = "New demo request from the InOrdera website:\n\n"
      . "Name: {$firstName} {$lastName}\n"
      . "Restaurant: {$restaurantName}\n"
      . "Email: {$email}\n"
      . "Phone: {$phone}\n"
      . "Locations: {$locations}\n";

$headers = "From: InOrdera Website <noreply@inordera.com>\r\n"
         . "Reply-To: {$firstName} {$lastName} <{$email}>\r\n"
         . "Content-Type: text/plain; charset=UTF-8";

if (!mail($to, $subject, $body, $headers)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send email']);
    exit;
}

echo json_encode(['success' => true]);
