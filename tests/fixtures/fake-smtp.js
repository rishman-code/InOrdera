// Tiny SMTP server for tests: accepts AUTH LOGIN and appends each message to
// test-results/smtp-outbox.log. A message containing "SMTPFAIL" is rejected.
const net = require('net');
const fs = require('fs');
const path = require('path');

const OUTBOX = path.join(__dirname, '..', '..', 'test-results', 'smtp-outbox.log');
const PORT = 2526;

function start() {
  fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
  const server = net.createServer(sock => {
    let buf = '', state = 'cmd', data = '', auth = [], session = {};
    const say = l => sock.write(l + '\r\n');
    say('220 fake-smtp ready');
    sock.on('data', chunk => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (state === 'data') {
          if (line === '.') {
            state = 'cmd';
            if (data.includes('SMTPFAIL')) { say('554 rejected'); continue; }
            fs.appendFileSync(OUTBOX, `--- MESSAGE auth=${session.user}:${session.pass} from=${session.from} to=${session.to}\n${data}\n`);
            say('250 queued');
          } else {
            data += line.replace(/^\.\./, '.') + '\n';
          }
        } else if (state === 'auth') {
          auth.push(Buffer.from(line, 'base64').toString());
          if (auth.length === 1) say('334 UGFzc3dvcmQ6');
          else { [session.user, session.pass] = auth; state = 'cmd'; say('235 ok'); }
        } else if (/^EHLO/i.test(line)) { say('250-fake-smtp'); say('250 AUTH LOGIN'); }
        else if (line === 'AUTH LOGIN') { state = 'auth'; auth = []; say('334 VXNlcm5hbWU6'); }
        else if (/^MAIL FROM:/i.test(line)) { session.from = line.slice(10); say('250 ok'); }
        else if (/^RCPT TO:/i.test(line)) { session.to = line.slice(8); say('250 ok'); }
        else if (line === 'DATA') { state = 'data'; data = ''; say('354 go'); }
        else if (line === 'QUIT') { say('221 bye'); sock.end(); }
        else say('500 unknown');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

module.exports = { start, OUTBOX };
