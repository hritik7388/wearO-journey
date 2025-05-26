const Joi = require("joi");
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel"; 
import wareHouseModel from '../../../../models/wareHouseModel'
import responseMessage from "../../../../../assets/responseMessage"; 
export class WarehouseController {

    /**
 * @swagger
 * /warehouse/createWarehouse:
 *   post:
 *     summary: Create a new warehouse
 *     tags:
 *       - WAREHOUSE
 *     description: Create a warehouse with manager and address details
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: token
 *         in: header
 *         required: true
 *         description: Bearer token for authentication
 *         type: string
 *       - in: body
 *         name: body
 *         required: true
 *         description: Warehouse details
 *         schema:
 *           type: object
 *           required:
 *             - warehouseName
 *             - address
 *             - manager
 *           properties:
 *             warehouseName:
 *               type: string
 *             address:
 *               type: object
 *               required:
 *                 - street
 *                 - city
 *                 - state
 *                 - country
 *                 - postalCode
 *                 - location
 *               properties:
 *                 street:
 *                   type: string
 *                 city:
 *                   type: string
 *                 state:
 *                   type: string
 *                 country:
 *                   type: string
 *                 postalCode:
 *                   type: string
 *                 location:
 *                   type: object
 *                   required:
 *                     - type
 *                     - coordinates
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [Point]
 *                     coordinates:
 *                       type: array
 *                       items:
 *                         type: number
 *             manager:
 *               type: object
 *               required:
 *                 - name
 *                 - contactNumber
 *               properties:
 *                 name:
 *                   type: string
 *                 contactNumber:
 *                   type: string
 *                 email:
 *                   type: string
 *             totalStock:
 *               type: number
 *             stockShipping:
 *               type: number
 *             revenue:
 *               type: number
 *             status:
 *               type: string
 *               enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *     responses:
 *       200:
 *         description: Warehouse created successfully
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized (Invalid or missing token)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
async createWarehouse(req, res, next) {
    const validationSchema = {
        warehouseName: Joi.string().required(),
        address: Joi.object({
            street: Joi.string().required(),
            city: Joi.string().required(),
            state: Joi.string().required(),
            country: Joi.string().required(),
            postalCode: Joi.string().required(),
            location: Joi.object({
                type: Joi.string().valid("Point").required(),
                coordinates: Joi.array().items(Joi.number()).length(2).required(), // [lng, lat]
            }).required(),
        }).required(),
        manager: Joi.object({
            name: Joi.string().required(),
            contactNumber: Joi.string().required(),
            email: Joi.string().email().optional(),
        }).required(),
        totalStock: Joi.number().optional(),
        stockShipping: Joi.number().optional(),
        revenue: Joi.number().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE", "MAINTENANCE").optional(),
    };

    try {
        const validatedBody = await Joi.validate(req.body,validationSchema);

        const userData = await userModel.findOne({
            _id: req.userId,
            status: { $ne: status.DELETE },
            userType: userType.ADMIN,
        });
        if (!userData) {
            throw apiError.notFound(responseMessage.USER_NOT_FOUND);
        }

        const warehouseData = await wareHouseModel.create(validatedBody);

        return res.status(200).json({
            status: true,
            message: responseMessage.WAREHOUSE_CREATED || "Warehouse created successfully",
            data: warehouseData,
        });
    } catch (error) {
        console.log("createWarehouse error:", error);
        return next(error);
    }
}

}
export default new WarehouseController();