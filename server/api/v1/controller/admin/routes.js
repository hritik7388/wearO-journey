import Express from "express";
import controller from "./controller";
import auth from "../../../../helper/auth";
import upload from "../../../../helper/uploadHandler";
export default Express.Router()
.get('/dashboard',controller.dashboard)
.post("/login", controller.login)
.post("/verifyOtp", controller.verifyOtp)
.post('/forgotPassword',controller.forgotPassword)
.post('/resendOTP',controller.resendOTP)
.use(auth.verifyToken)
.use(upload.uploadFile)
.put("/updateAdminProfile", controller.updateAdminProfile)
.post('/resetPassword',controller.resetPassword) 
.patch('/changePassword',controller.changePassword)
.get('/adminProfile',controller.adminProfile)
  .get("/viewUser", controller.viewUser)
  .delete("/deleteUser", controller.deleteUser)
  .put("/blockUnblockUser", controller.blockUnblockUser)
  .get("/listUser", controller.listUser)
