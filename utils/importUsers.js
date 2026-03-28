const mongoose = require('mongoose');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const path = require('path');
const User = require('../schemas/users');
const Role = require('../schemas/roles');
const { sendPasswordEmail } = require('./mailHandler');

mongoose.connect('mongodb://localhost:27017/NNPTUD-S4');

function genPassword() {
  return crypto.randomBytes(12).toString('base64').slice(0, 16);
}

async function importUsers() {
  await new Promise(res => mongoose.connection.once('open', res));

  let userRole = await Role.findOne({ name: 'Người dùng' });
  if (!userRole) {
    userRole = await Role.create({ name: 'Người dùng', description: 'Tài khoản người dùng thông thường' });
    console.log('Đã tạo role "Người dùng"');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(__dirname, '../users.xlsx'));
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return; // bỏ header
    const username = row.getCell(1).value?.toString().trim();
    const email = row.getCell(2).value?.toString().trim();
    if (username && email) rows.push({ username, email });
  });

  for (const u of rows) {
    const exists = await User.findOne({ $or: [{ username: u.username }, { email: u.email }] });
    if (exists) {
      console.log(`Bỏ qua (đã tồn tại): ${u.username}`);
      continue;
    }

    const plainPassword = genPassword();
    await new User({ username: u.username, email: u.email, password: plainPassword, role: userRole._id }).save();
    await new Promise(r => setTimeout(r, 500));
    await sendPasswordEmail(u.email, u.username, plainPassword);
    console.log(`✓ ${u.username} <${u.email}>`);
  }

  console.log('Import hoàn tất!');
  process.exit(0);
}

importUsers().catch(err => { console.error(err); process.exit(1); });
