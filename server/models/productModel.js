import gender from "../enum/gender"; 
import status from "../enum/status";
import Mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";
const options = {
    collection: "product",
    timestamps: true,
};

const productModel = new Schema(
    {
        productName: {
            type: String,
            required: true,
        },
        productCategory: {
            type: String, //fashion,electronics
            required: true,
        },
        brand: {
            type: String,
        },
        weight: {
            type: String, //  gm or kg
        },
        gender: {
            type: String,
            enum: [gender.MALE, gender.FEMALE, gender.OTHER,gender.UNISEX],
        },
        sizes: [String], // e.g. ["S", "M", "L", "XL"]
        colors: [String], // e.g. ["Red", "Blue", "Black"]
        description: {
            type: String,
        },
        tagNumber: {
            type: String, // e.g. "#SKU1234"
        },

        stock: {
            type: Number,
            default: 0,
        },

        tags: [String], // e.g. ["Fashion", "Casual", "Trending"]
        price: {
            type: Number,
            required: true,
        },

        discount: {
            type: Number,
            default: 0, // In percentage
        },
        images: [
            {
                type: String, // file path or URL
            },
        ],
        status: {
            type: String,
            enum: [status.ACTIVE, status.BLOCKED, status.DELETED,status.OUT_OF_STOCK,status.UPCOMING],
            default: status.ACTIVE,
        },
    },
    options
);
productModel.plugin(mongoosePaginate);
productModel.plugin(mongooseAggregatePaginate);
module.exports = Mongoose.model("product", productModel);
