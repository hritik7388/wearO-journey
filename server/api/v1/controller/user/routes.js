import Express from 'express';
import controller from "./controller";
import auth from "../../../../helper/auth";
import upload from "../../../../helper/uploadHandler";
export default Express.Router()

.post ('/signUp',controller.signUp)
.post ('/verifyOtp',controller.verifyOtp)
.post('/login',controller.login)
.post('/forgotPassword',controller.forgotPassword)
.post('/resendOTP',controller.resendOTP)
.use(auth.verifyToken)
.use(upload.uploadFile)
.put("/updateUserProfile", controller.updateUserProfile)
.get('/listAllUser',controller.listAllUser) 
.post('/resetPassword',controller.resetPassword) 
.patch('/changePassword',controller.changePassword)
.get('/userProfile',controller.userProfile)

  .get("/viewUser", controller.viewUser)
  .delete("/deleteUser", controller.deleteUser)

