const Joi = require("joi");  
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util"; 
import response from '../../../../../assets/response'
import userModel from "../../../../models/userModel";
import responseMessage from "../../../../../assets/responseMessage";

export class adminController {
    /**
     * @swagger
     * /admin/login:
     *   post:
     *     tags:
     *       - ADMIN
     *     description: login with email || mobileNumber and passCode
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: login
     *         description: Login details
     *         in: body
     *         required: true
     *         schema:
     *           type: object
     *           properties:
     *             email:
     *               type: string
     *             password:
     *               type: string
     *             deviceToken:
     *               type: string
     *             deviceType:
     *               type: string
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async login(req, res,next) {
        var validationSchema = {
            email: Joi.string().required(),
            password: Joi.string().optional(),
            deviceToken: Joi.string().allow("").optional(),
            deviceType: Joi.string().allow("").optional(),
        };
        try {
            let results;
        var validatedBody = await Joi.validate(req.body, validationSchema);
            const {email, password, deviceToken, deviceType} = validatedBody;
            let userResult = await userModel.findOne({
                email: email,
                userType: userType.ADMIN,
                status: {$ne: status.DELETE},
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            if (!bcrypt.compareSync(password, userResult.password)) {
                throw apiError.conflict(responseMessage.PASSWORD_NOT_MATCH);
            } else {
                var token = await commonFunction.getToken({
                    _id: userResult._id,
                    email: userResult.email, 
                    userType: userResult.userType,
                    status: userResult.status,
                    deviceToken: deviceToken,
                    deviceType: deviceType,
                });
                 results = {
                    _id: userResult._id,
                    email: email,
                    speakeasy: userResult.speakeasy,
                    userType: userResult.userType,
                    token: token,
                };
            }
            return res.json(new response(results, responseMessage.LOGIN));
        } catch (error) {
            console.log(error);
            return next(error);
        }
    }
}
export default new adminController();
//work on progress
