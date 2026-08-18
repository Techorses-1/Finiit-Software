const dynamoose = require("dynamoose");

const userSchema = new dynamoose.Schema(
  {
    userId: {
      type: String,
      hashKey: true,
      default: () => require("uuid").v4(),
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

const User = dynamoose.model("Users", userSchema);

module.exports = User;