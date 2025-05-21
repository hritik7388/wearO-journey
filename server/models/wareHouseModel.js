import Mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "warehouse",
    timestamps: true,
};

const warehouseSchema = new Schema(
    {
        warehouseName: {
            type: String,
            required: true,
            trim: true,
        },
 
        address: {
            street: {type: String, required: true},
            city: {type: String, required: true},
            state: {type: String, required: true},
            country: {type: String, required: true},
            postalCode: {type: String, required: true},
            location: {
                type: {
                    type: String,
                    enum: ["Point"],
                    default: "Point",
                    required: true,
                },
                coordinates: {
                    type: [Number], // [longitude, latitude]
                    required: true,
                },
            },
        },
        manager: {
            name: {type: String, required: true},
            contactNumber: {type: String, required: true},
            email: {type: String, required: false},
        },
        totalStock: {
            type: Number,
            default: 0, // Total items across all inventory
        },
        stockShipping: {
            type: Number,
            default: 0, // Items currently shipping or reserved for shipping
        },
        revenue: {
            type: Number,
            default: 0, // Total revenue generated from this warehouse
        },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE",
        },
    },
    options
);

warehouseSchema.plugin(mongoosePaginate);
warehouseSchema.plugin(mongooseAggregatePaginate);

module.exports = Mongoose.model("warehouse", warehouseSchema);
