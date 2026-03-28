const nodemailer = require('nodemailer');

const mailTransport = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: '86d87f3e5aaf14',
    pass: '59357926be6ccb'
  }
});

async function sendPasswordEmail(toEmail, username, plainPassword) {
  const html =
    '<p>Xin chào <strong>' + username + '</strong>,</p>' +
    '<p>Tài khoản của bạn đã được tạo thành công.</p>' +
    '<p><strong>Username:</strong> ' + username + '</p>' +
    '<p><strong>Password:</strong> ' + plainPassword + '</p>' +
    '<p>Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>';

  const text =
    'Xin chào ' + username + ',\n' +
    'Username: ' + username + '\n' +
    'Password: ' + plainPassword + '\n';

  const info = await mailTransport.sendMail({
    from: 'noreply@example.com',
    to: toEmail,
    subject: 'Thông báo tạo tài khoản',
    text,
    html
  });

  return info;
}

module.exports = {
  sendPasswordEmail
};
