const Joi = require("joi");
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel"; 
import responseMessage from "../../../../../assets/responseMessage"; 

export class productController {
    /**
     * @swagger
     * /product/createProduct:
     *   post:
     *     summary: Create a new product
     *     tags:
     *       - PRODUCT
     *     description: Create a product with details like name, category, price, discount, stock, and images.
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
     *         description: Product details
     *         schema:
     *           type: object
     *           required:
     *             - productName
     *             - productCategory
     *             - brand
     *             - weight
     *             - gender
     *             - sizes
     *             - colors
     *             - description
     *             - stock
     *             - tags
     *             - price
     *             - discount
     *             - images
     *             - productStatus
     *           properties:
     *             productName:
     *               type: string
     *             productCategory:
     *               type: string
     *               enum: [fashion, electronics]
     *             brand:
     *               type: string
     *             weight:
     *               type: string
     *             gender:
     *               type: string
     *               enum: [MALE, FEMALE, OTHER]
     *             sizes:
     *               type: array
     *               items:
     *                 type: string
     *             colors:
     *               type: array
     *               items:
     *                 type: string
     *             description:
     *               type: string
     *             stock:
     *               type: number
     *             tags:
     *               type: array
     *               items:
     *                 type: string
     *             price:
     *               type: number
     *             discount:
     *               type: number
     *             images:
     *               type: array
     *               items:
     *                 type: string
     *             productStatus:
     *               type: string
     *               enum: [ACTIVE, BLOCKED, DELETED, OUT_OF_STOCK, UPCOMING]
     *     responses:
     *       200:
     *         description: Product successfully created
     *       400:
     *         description: Validation error or bad request
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: User not found
     *       500:
     *         description: Internal server error
     */

    async createProduct(req, res, next) {
        const validationSchema = {
            productName: Joi.string().required(),
            productCategory: Joi.string().valid("fashion", "electronics").required(),
            brand: Joi.string().required(),
            weight: Joi.string().required(),
            gender: Joi.string().valid("MALE", "FEMALE", "OTHER").required(),
            sizes: Joi.array().items(Joi.string()).required(),
            colors: Joi.array().items(Joi.string()).required(),
            description: Joi.string().required(),
            stock: Joi.number().required(),
            tags: Joi.array().items(Joi.string()).required(),
            price: Joi.number().required(),
            discount: Joi.number().required(),
            images: Joi.array().items(Joi.string()).required(),
            productStatus: Joi.string().valid("ACTIVE", "BLOCKED", "DELETED", "OUT_OF_STOCK", "UPCOMING").required(),
        };
        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);
            const {
                productName,
                productCategory,
                brand,
                weight,
                gender,
                sizes,
                colors,
                description,
                stock,
                tags,
                price,
                discount,
                images,
                productStatus,
            } = validatedBody;
            const userData = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userData) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            const TGN = commonFunction.generateTagNumber();
            const finalPrice = validatedBody.price - (validatedBody.price * validatedBody.discount) / 100;

            const productData = await productModel.create({
                productName: validatedBody.productName,
                productCategory: validatedBody.productCategory,
                brand: validatedBody.brand,
                weight: validatedBody.weight,
                gender: validatedBody.gender,
                sizes: validatedBody.sizes,
                colors: validatedBody.colors,
                description: validatedBody.description,
                tagNumber: TGN,
                stock: validatedBody.stock,
                tags: validatedBody.tags,
                price: finalPrice,
                discount: validatedBody.discount,
                images: validatedBody.images,
                productStatus: validatedBody.productStatus,
            });

            res.status(200).json({
                status: true,
                message: responseMessage.PRODUCT_CREATED,
                data: productData,
            });
        } catch (error) {
            console.log("error", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /product/updateProduct:
     *   put:
     *     summary: Update a product
     *     tags:
     *       - PRODUCT
     *     description: update a product with details like name, category, price, discount, stock, and images.
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
     *       - name: _id
     *         in: query
     *         required: true
     *         description: Product ID to update
     *         type: string
     *       - in: body
     *         name: body
     *         required: true
     *         description: Product details
     *         schema:
     *           type: object
     *           required:
     *             - productName
     *             - productCategory
     *             - brand
     *             - weight
     *             - gender
     *             - sizes
     *             - colors
     *             - description
     *             - stock
     *             - tags
     *             - price
     *             - discount
     *             - images
     *             - productStatus
     *           properties:
     *             productName:
     *               type: string
     *             productCategory:
     *               type: string
     *               enum: [fashion, electronics]
     *             brand:
     *               type: string
     *             weight:
     *               type: string
     *             gender:
     *               type: string
     *               enum: [MALE, FEMALE, OTHER]
     *             sizes:
     *               type: array
     *               items:
     *                 type: string
     *             colors:
     *               type: array
     *               items:
     *                 type: string
     *             description:
     *               type: string
     *             stock:
     *               type: number
     *             tags:
     *               type: array
     *               items:
     *                 type: string
     *             price:
     *               type: number
     *             discount:
     *               type: number
     *             images:
     *               type: array
     *               items:
     *                 type: string
     *             productStatus:
     *               type: string
     *               enum: [ACTIVE, BLOCKED, DELETED, OUT_OF_STOCK, UPCOMING]
     *     responses:
     *       200:
     *         description: Product successfully updated
     *       400:
     *         description: Validation error or bad request
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: User not found
     *       500:
     *         description: Internal server error
     */
    async updateProduct(req, res, next) {
        const validationSchema = {
            _id: Joi.string().required(),
            productName: Joi.string().required(),
            productCategory: Joi.string().valid("fashion", "electronics").required(),
            brand: Joi.string().required(),
            weight: Joi.string().required(),
            gender: Joi.string().valid("MALE", "FEMALE", "OTHER").required(),
            sizes: Joi.array().items(Joi.string()).required(),
            colors: Joi.array().items(Joi.string()).required(),
            description: Joi.string().required(),
            stock: Joi.number().required(),
            tags: Joi.array().items(Joi.string()).required(),
            price: Joi.number().required(),
            discount: Joi.number().required(),
            images: Joi.array().items(Joi.string()).required(),
            productStatus: Joi.string().valid("ACTIVE", "BLOCKED", "DELETED", "OUT_OF_STOCK", "UPCOMING").required(),
        };
        try {
            const dataToValidate = {
                ...req.body,
                _id: req.query._id,
            };
            const validatedBody = await Joi.validate(dataToValidate, validationSchema);
            const {
                _id,
                productName,
                productCategory,
                brand,
                weight,
                gender,
                sizes,
                colors,
                description,
                stock,
                tags,
                price,
                discount,
                images,
                productStatus,
            } = validatedBody;
            const userData = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userData) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            const product = await productModel.findOne({
                _id: validatedBody._id,
                status: {$ne: status.DELETE},
            });
            if (!product) {
                throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);
            }
            const TGN = commonFunction.generateTagNumber();
            const finalPrice = validatedBody.price - (validatedBody.price * validatedBody.discount) / 100;

            const productData = await productModel.findByIdAndUpdate(
                {
                    _id: validatedBody._id,
                    status: {$ne: status.DELETE},
                },
                {
                    $set: {
                        productName: validatedBody.productName,
                        productCategory: validatedBody.productCategory,
                        brand: validatedBody.brand,
                        weight: validatedBody.weight,
                        gender: validatedBody.gender,
                        sizes: validatedBody.sizes,
                        colors: validatedBody.colors,
                        description: validatedBody.description,
                        tagNumber: TGN,
                        stock: validatedBody.stock,
                        tags: validatedBody.tags,
                        price: finalPrice,
                        discount: validatedBody.discount,
                        images: validatedBody.images,
                        productStatus: validatedBody.productStatus,
                    },
                },
                {new: true}
            );

            res.status(200).json({
                status: true,
                message: responseMessage.PRODUCT_UPDATED,
                data: productData,
            });
        } catch (error) {
            console.log("error", error);
            return next(error);
        }
    }


}
export default new productController();
