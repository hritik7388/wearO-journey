import config from "config";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel";
import apiError from './apiError';
import responseMessage from '../../assets/responseMessage';
module.exports = {

async verifyToken(req, res, next) {
  try {
    const token = req.headers.token;
    if (!token) {
      throw apiError.invalid(responseMessage.NO_TOKEN);
    }

    const decoded = jwt.verify(token, config.get('jwtsecret'));
    const user = await userModel.findOne({ _id: decoded._id });

    if (!user) {
      return res.status(404).json({
        responseCode: 404,
        responseMessage: "USER NOT FOUND",
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        responseCode: 403,
        responseMessage: "You have been blocked by admin.",
      });
    }

    if (user.status === "DELETE") {
      return res.status(402).json({
        responseCode: 402,
        responseMessage: "Your account has been deleted by admin.",
      });
    }

    req.userId = user._id;
    req.userDetails = user;
    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(440).send({
        responseCode: 440,
        responseMessage: "Session Expired, Please login again.",
      });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        responseCode: 401,
        responseMessage: "Invalid Token",
      });
    } else {
      return next(err);
    }
  }
},

  // async verifyToken(req, res, next) {
  //   try {
  //     if (req.headers.token) {
  //       let result = await jwt.verify(req.headers.token, config.get('jwtsecret'));
  //       let userData = await userModel.findOne({ _id: result.id });
  //       if (!userData) {
  //         throw apiError.notFound(responseMessage.USER_NOT_FOUND);
  //       }
  //       else {
  //         if (userData.status == "BLOCK") {
  //           throw apiError.forbidden(responseMessage.BLOCK_BY_ADMIN);
  //         }
  //         else if (userData.status == "DELETE") {
  //           throw apiError.unauthorized(responseMessage.DELETE_BY_ADMIN);
  //         }
  //         else {
  //           req.userId = result.id;
  //           req.userDetails = result
  //           next();
  //         }
  //       }
  //     } else {
  //       throw apiError.badRequest(responseMessage.NO_TOKEN);
  //     }

  //   } catch (error) {
  //     return next(error);

  //   }

  // },

  verifyTokenBySocket: (token) => {
    return new Promise((resolve, reject) => {
      try {
        if (token) {
          jwt.verify(token, config.get('jwtsecret'), (err, result) => {
            if (err) {
              reject(apiError.unauthorized());
            }
            else {
              userModel.findOne({ _id: result.id }, (error, result2) => {
                if (error)
                  reject(apiError.internal(responseMessage.INTERNAL_ERROR));
                else if (!result2) {
                  reject(apiError.notFound(responseMessage.USER_NOT_FOUND));
                }
                else {
                  if (result2.status == "BLOCK") {
                    reject(apiError.forbidden(responseMessage.BLOCK_BY_ADMIN));
                  }
                  else if (result2.status == "DELETE") {
                    reject(apiError.unauthorized(responseMessage.DELETE_BY_ADMIN));
                  }
                  else {
                    resolve(result.id);
                  }
                }
              })
            }
          })
        } else {
          reject(apiError.badRequest(responseMessage.NO_TOKEN));
        }
      }
      catch (e) {
        reject(e);
      }
    })
  }

}


