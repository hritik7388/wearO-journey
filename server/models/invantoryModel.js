import Mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "inventory",
    timestamps: true,
};

const inventorySchema = new Schema(
    {
        productId: {type: Schema.Types.ObjectId, ref: "product", required: true},
        warehouseId: {type: Schema.Types.ObjectId, ref: "warehouse", required: true},
        color: {type: String, required: true},
        size: {type: String, required: true},
        brand: {type: String},
        stockAvailable: {type: Number, default: 0},
        stockReserved: {type: Number, default: 0},
        stockDamaged: {type: Number, default: 0},
        stockInTransit: {type: Number, default: 0},
        lastUpdated: {type: Date, default: Date.now},
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
            default: "ACTIVE",
        },
        images: [
            {
                type: String, // file path or URL
            },
        ],
    },
    options
);

inventorySchema.plugin(mongoosePaginate);
inventorySchema.plugin(mongooseAggregatePaginate);
inventorySchema.index({location: "2dsphere"});

module.exports = Mongoose.model("inventory", inventorySchema);
