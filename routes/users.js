var express = require("express");
var router = express.Router();
let path = require('path');
let exceljs = require('exceljs');
let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let { uploadExcel } = require('../utils/uploadHandler');
let { sendPasswordEmail } = require('../utils/mailHandler');
let { CreateAnUserValidator, validatedResult, ModifyAnUser } = require('../utils/validateHandler')
let userController = require('../controllers/users')
let { CheckLogin,CheckRole } = require('../utils/authHandler')

function generateRandomPassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

router.get("/", CheckLogin,CheckRole("ADMIN"), async function (req, res, next) {
  let users = await userController.GetAllUser()
  res.send(users);
});

router.post('/import', CheckLogin, CheckRole('ADMIN'), uploadExcel.single('file'), function(err, req, res, next) {
  if (err) return res.status(400).send({ message: err.message });
  next();
}, async function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'Vui lòng cung cấp file import (xlsx) với 2 cột username và email.' });
    }

    let workbook = new exceljs.Workbook();
    let pathFile = path.join(__dirname, '../uploads', req.file.filename);
    await workbook.xlsx.readFile(pathFile);
    let worksheet = workbook.worksheets[0];

    const role = await roleModel.findOne({ name: /user/i, isDeleted: false });
    if (!role) {
      return res.status(400).send({ message: 'Role user không tồn tại. Vui lòng tạo role user trước.' });
    }

    let result = [];

    for (let row = 2; row <= worksheet.rowCount; row++) {
      let rowData = worksheet.getRow(row);
      let username = (rowData.getCell(1).value || '').toString().trim();
      let email = (rowData.getCell(2).value || '').toString().trim().toLowerCase();

      if (!username || !email) {
        result.push({ row, status: 'skipped', message: 'Thiếu username hoặc email' });
        continue;
      }

      const existsUsername = await userController.GetAnUserByUsername(username);
      const existsEmail = await userController.GetAnUserByEmail(email);
      if (existsUsername || existsEmail) {
        result.push({ row, username, email, status: 'skipped', message: 'username hoặc email đã tồn tại' });
        continue;
      }

      const password = generateRandomPassword(16);
      const newUser = await userController.CreateAnUser(username, password, email, role._id, null, '', '', false, 0);

      try {
        await sendPasswordEmail(email, username, password);
        result.push({ row, username, email, status: 'created', message: 'Thành công, email đã gửi' });
      } catch (mailError) {
        result.push({ row, username, email, status: 'created-email_fail', message: mailError.message });
      }
    }

    res.send({ summary: result });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

router.get("/:id", CheckLogin,CheckRole("ADMIN","MODERATOR"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount
    )
    // populate cho đẹp
    let saved = await userModel
      .findById(newItem._id)
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUser, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;