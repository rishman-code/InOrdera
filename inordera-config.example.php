<?php
// Copy this file to inordera-config.php ONE LEVEL ABOVE the web root
// (on cPanel: /home/inoratey/inordera-config.php, next to public_html/),
// fill in the mailbox password, and never commit the real file.
return [
    // Namecheap Private Email SMTP
    'smtp_host'   => 'mail.privateemail.com',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',            // 'ssl' (port 465) or 'tls' (STARTTLS, port 587)
    'smtp_user'   => 'hello@inordera.com',
    'smtp_pass'   => 'CHANGE-ME',
    'from_email'  => 'hello@inordera.com',   // must be the mailbox above

    // Where enquiries are emailed
    'to_email'    => 'rishi.shinn@hotmail.co.uk',

    // Optional: where enquiries are saved (defaults to ../inordera-leads/leads.csv)
    // 'leads_file' => '/home/inoratey/inordera-leads/leads.csv',
];
