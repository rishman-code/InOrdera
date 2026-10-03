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
$interest       = clean_field($_POST['interest'] ?? 'demo');

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

$interestLabels = [
    'demo'              => 'Book a demo',
    'roi_followup'      => 'ROI calculator follow-up',
    'trial'             => 'Free trial request',
    'founding_programme'=> 'Founding Restaurant Programme application',
    'sales'             => 'Talk to sales (multi-site)',
    'integrations'      => 'POS integration enquiry',
    'website_ordering'  => 'Website ordering enquiry',
    'pricing'           => 'Pricing enquiry',
];
$interestLabel = $interestLabels[$interest] ?? 'Book a demo';

// Settings live outside the web root so the SMTP password is never served or
// committed. See inordera-config.example.php for the format.
$configPath = getenv('INORDERA_CONFIG') ?: dirname(__DIR__) . '/inordera-config.php';
$config = is_file($configPath) ? require $configPath : [];

$to = $config['to_email'] ?? 'rishi.shinn@hotmail.co.uk';
$subject = 'New ' . strtolower($interestLabel) . ': ' . $restaurantName;

$body = "New enquiry from the InOrdera website:\n\n"
      . "Type: {$interestLabel}\n"
      . "Name: {$firstName} {$lastName}\n"
      . "Restaurant: {$restaurantName}\n"
      . "Email: {$email}\n"
      . "Phone: {$phone}\n"
      . "Locations: {$locations}\n";

// Save the lead before emailing so it survives a mail failure.
$leadsFile = $config['leads_file'] ?? dirname(__DIR__) . '/inordera-leads/leads.csv';
$saved = save_lead($leadsFile, [
    gmdate('Y-m-d H:i:s'), $interestLabel, $firstName, $lastName,
    $restaurantName, $email, $phone, $locations,
]);

try {
    if (!empty($config['smtp_host'])) {
        smtp_send($config, $to, $subject, $body, "{$firstName} {$lastName}", $email);
    } else {
        $headers = "From: InOrdera Website <noreply@inordera.com>\r\n"
                 . "Reply-To: {$firstName} {$lastName} <{$email}>\r\n"
                 . "Content-Type: text/plain; charset=UTF-8";
        if (!mail($to, $subject, $body, $headers)) {
            throw new RuntimeException('mail() returned false');
        }
    }
    $sent = true;
} catch (Throwable $e) {
    error_log('InOrdera enquiry email failed: ' . $e->getMessage());
    $sent = false;
}

if (!$saved && !$sent) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send email']);
    exit;
}

echo json_encode(['success' => true]);

function save_lead(string $file, array $row): bool {
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        error_log("InOrdera: cannot create leads directory {$dir}");
        return false;
    }
    $isNew = !is_file($file);
    $fh = @fopen($file, 'a');
    if (!$fh) {
        error_log("InOrdera: cannot open leads file {$file}");
        return false;
    }
    flock($fh, LOCK_EX);
    if ($isNew) {
        fputcsv($fh, ['Received (UTC)', 'Type', 'First name', 'Last name', 'Restaurant', 'Email', 'Phone', 'Locations'], ',', '"', '');
    }
    // Stop spreadsheet apps treating submitted text as a formula.
    $row = array_map(fn($v) => preg_match('/^[=+\-@\t]/', $v) ? "'" . $v : $v, $row);
    $ok = fputcsv($fh, $row, ',', '"', '') !== false;
    flock($fh, LOCK_UN);
    fclose($fh);
    return $ok;
}

// Minimal authenticated SMTP client (AUTH LOGIN over SSL or STARTTLS), so the
// email is sent by the domain's mail provider and passes SPF/DKIM.
function smtp_send(array $c, string $to, string $subject, string $body, string $replyName, string $replyEmail): void {
    $secure = $c['smtp_secure'] ?? 'ssl';
    $port = (int)($c['smtp_port'] ?? ($secure === 'ssl' ? 465 : 587));
    $from = $c['from_email'] ?? $c['smtp_user'];
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $c['smtp_host'] . ':' . $port;

    $sock = @stream_socket_client($remote, $errno, $errstr, 15);
    if (!$sock) throw new RuntimeException("connect {$remote}: {$errstr}");
    stream_set_timeout($sock, 15);

    $read = function () use ($sock): string {
        $resp = '';
        while (($line = fgets($sock, 515)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $resp;
    };
    $cmd = function (?string $line, int $expect, ?string $label = null) use ($sock, $read): string {
        if ($line !== null) fwrite($sock, $line . "\r\n");
        $resp = $read();
        if ((int)substr($resp, 0, 3) !== $expect) {
            // Name the step without logging credentials or the message body.
            $shown = $label ?? ($line === null ? 'greeting' : strtok($line, " :\r\n"));
            throw new RuntimeException("SMTP '{$shown}' expected {$expect}, got: " . trim($resp));
        }
        return $resp;
    };

    try {
        $cmd(null, 220);
        $cmd('EHLO inordera.com', 250);
        if ($secure === 'tls') {
            $cmd('STARTTLS', 220);
            if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS negotiation failed');
            }
            $cmd('EHLO inordera.com', 250);
        }
        $cmd('AUTH LOGIN', 334);
        $cmd(base64_encode($c['smtp_user']), 334, 'username');
        $cmd(base64_encode($c['smtp_pass']), 235, 'password');
        $cmd("MAIL FROM:<{$from}>", 250);
        $cmd("RCPT TO:<{$to}>", 250);
        $cmd('DATA', 354);

        $headers = [
            'Date: ' . date('r'),
            'From: InOrdera Website <' . $from . '>',
            'To: <' . $to . '>',
            'Reply-To: ' . mb_encode_mimeheader($replyName, 'UTF-8') . ' <' . $replyEmail . '>',
            'Subject: ' . mb_encode_mimeheader($subject, 'UTF-8'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@inordera.com>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $msg = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $body);
        $msg = preg_replace('/^\./m', '..', $msg); // dot-stuffing
        $cmd($msg . "\r\n.", 250, 'message');
        fwrite($sock, "QUIT\r\n");
    } finally {
        fclose($sock);
    }
}
