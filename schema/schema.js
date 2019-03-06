const graphql = require('graphql');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLFloat } = graphql;
const User = require('../models/user');
const Order = require('../models/order');
const Product = require('../models/product');
const ShippingOption = require('../models/shippingOption');
const bcrypt = require('bcrypt');
const saltRounds = 10;


const UserOrders = getOrderType('UserOrders');
function getUserType(name) {
  return new GraphQLObjectType({
      name,
      fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        password: { type: GraphQLString },
        orders: {
          type: new GraphQLList(UserOrders),
          resolve(parentValue) {
            const orderIds = parentValue.orders.map((order) => {
                return order.id.toString('hex')
            })
            return Order.find({"_id": {$in: orderIds}});
          }
        }
      })
  });
}

const OrderProducts = new GraphQLObjectType({
  name: 'OrderProducts',
  fields: {
    title: { type: GraphQLString },
    amount: { type: GraphQLInt },
    price: { type: GraphQLFloat },
    total: { type: GraphQLFloat },
    product: { type: getProductType('OrderProductsProduct')}
  }
});

const UserOfOrder = getUserType('UserOfOrder');
function getOrderType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      total: { type: GraphQLFloat },
      totalWithShipping: { type: GraphQLFloat },
      shippingCost: { type: GraphQLFloat },
      status: { type: GraphQLString },
      products: { type: new GraphQLList(OrderProducts) },
      user: {
        type: UserOfOrder,
        resolve(parentValue) {
          const userId = parentValue.user.id.toString('hex');
          return Order.findById(userId);
        }
      }
    })
  });
}

function getProductType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      title: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title[language]
      },
      descriptionShort: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title[language]
      },
      descriptionLong: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title[language]
      },
      weight: { type: GraphQLInt },
      amount: { type: GraphQLInt },
      available: { type: GraphQLBoolean },
      imgSmall: { type: new GraphQLList(GraphQLString) },
      imgBig: { type: new GraphQLList(GraphQLString) },
      price: { type: GraphQLFloat },
    })
  });
}

const ShippingProviderOptions = new GraphQLObjectType({
  name: 'ShippingProviderOptions',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    price: { type: new GraphQLNonNull(GraphQLFloat) },
  }
});

function getShippingOptionType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      name: { type: new GraphQLNonNull(GraphQLString)},
      address: { type: new GraphQLNonNull(new GraphQLList(GraphQLString))},
      options: { type: new GraphQLNonNull (new GraphQLList(ShippingProviderOptions)) }
    })
  });
}

const UserType = getUserType('User');
const OrderType = getOrderType('Order');
const ProductType = getProductType('Product');
const ShippingOptionType = getShippingOptionType('ShippingOption')

const RootQueryType = new GraphQLObjectType({
  name: 'RootQuery',
  fields: () => ({
    users: {
      type: new GraphQLList(UserType),
      resolve() {
          return User.find({});
      }
    },
    user: {
      type: UserType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return User.findById(id);
      }
    },
    products: {
      type: new GraphQLList(ProductType),
      resolve() {
          return Product.find({});
      }
    },
    product: {
      type: ProductType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return Product.findById(id);
      }
    },
    orders: {
      type: new GraphQLList(OrderType),
      resolve() {
          return Order.find({});
      }
    },
    order: {
      type: OrderType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return Order.findById(id);
      }
    },
    shippingOptions: {
      type: new GraphQLList(ShippingOptionType),
      resolve() {
          return ShippingOption.find({});
      }
    },
    shippingOption: {
      type: ShippingOptionType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return ShippingOption.findById(id);
      }
    },
  })
});

const mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addUser: {
      type: new GraphQLObjectType({ name: 'NewUser', fields: { user: { type: UserType } } }),
      args: {
          username: { type: new GraphQLNonNull(GraphQLString) },
          email: { type: new GraphQLNonNull(GraphQLString)},
          password: { type: new GraphQLNonNull(GraphQLString)},
      },
      resolve: (parentValue, { username, email, password }) => {
        return new Promise((resolve, reject) => {
          bcrypt.hash(password, saltRounds, (err, hash) => {
            new User({ username, email, password: hash }).save((err, user) => {
              if (err) {
                console.log(err)
              }
              resolve({ user });
            });
          });
        });
      }
    },
    addProduct: {
      type: new GraphQLObjectType({ name: 'NewProduct', fields: { product: { type: ProductType } } }),
      args: {
        title: { type: new GraphQLInputObjectType({
          name: 'productTitle',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionShort: { type: new GraphQLInputObjectType({
          name: 'productDescriptionShort',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionLong: { type: new GraphQLInputObjectType({
          name: 'productDescriptionLong',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        weight: { type: GraphQLInt},
        amount: { type: GraphQLInt},
        available: { type: GraphQLBoolean},
        imgSmall: { type: new GraphQLList(GraphQLString)},
        imgBig: { type: new GraphQLList(GraphQLString)},
        price: { type: new GraphQLNonNull(GraphQLFloat)},
      },
      resolve: async (parentValue, args) => {
        const dbArgs = {};
        Object.keys(args).forEach((key) => {
          dbArgs[key] = args[key];
        });
        const product = await new Product(dbArgs).save();
        return { product };
      }
    },
    addOrder: {
      type: new GraphQLObjectType({ name: 'NewOrder', fields: { order: { type: OrderType } } }),
      args: {
        total: { type: new GraphQLNonNull(GraphQLFloat)},
        totalWithShipping: { type: new GraphQLNonNull(GraphQLFloat)},
        shippingCost: { type: new GraphQLNonNull(GraphQLFloat)},
        status: { type: new GraphQLNonNull(new GraphQLEnumType({ name: 'OrderStatus', values: { 
          NEW: { value: 'NEW' },
          PAID: { value: 'PAID' },
          SENT: { value: 'SENT' },
          RECEIVED: { value: 'RECEIVED' },
          CANCELLED: { value: 'CANCELLED' },
        }}))},
        userId: { type: new GraphQLNonNull(GraphQLID) },
        orderProducts: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLInputObjectType({
            name: 'orderProductsInput',
            fields: {
              id: { type: new GraphQLNonNull(GraphQLID)},
              amount: { type: new GraphQLNonNull(GraphQLInt)},
            }
          }))),
        },
      },
      resolve: async (parentValue, { total, totalWithShipping, shippingCost, status, userId, orderProducts }) => {
        const productIds = orderProducts.map(({ id }) => id);
        const [user, products] = await Promise.all([
          await User.findById(userId),
          await Product.find({ _id: { $in: productIds }}),
        ]);
        if (user && products && products.length === productIds.length) {
          const order = await new Order({
            total, totalWithShipping, shippingCost, status, user,
            products: products.map(product => {
              const amount = orderProducts.find(({ id }) => id === product.id).amount;
              const total = amount * product.price;
              return {
                amount,
                total,
                product,
                title: product.title.en,
                price: product.price,
              };
            }),
          }).save();
          return { order };
        }
        return { order: null };
      }
    },
    addShippingOption: {
      type: new GraphQLObjectType({ name: 'NewShippingOption', fields: { shippingOption: { type: ShippingOptionType } } }),
      args: {
        name: { type: new GraphQLNonNull(GraphQLString)},
        address: { type: new GraphQLNonNull(new GraphQLList(GraphQLString))},
        options: { type: new GraphQLNonNull(new GraphQLList(new GraphQLInputObjectType({
          name: 'ShippingProviderOptionsInput',
          fields: {
            name: { type: new GraphQLNonNull(GraphQLString) },
            price: { type: new GraphQLNonNull(GraphQLFloat) },
          }
        })))}
      },
      resolve: async (parentValue, { name, address, options }) => {
        const shippingOption = await new ShippingOption({ name, address, options}).save();
        return { shippingOption };
      },
    },
    // addActor: {
    //     type: ActorType,
    //     args: {
    //         name: { type: new GraphQLNonNull(GraphQLString) },
    //         age: { type: GraphQLString}
    //     },
    //     resolve(parentValue, { name, age }) {
    //         return (new Actor({ name, age })).save();
    //     }
    // },
    // editMovie: {
    //     type: MovieType,
    //     args: {
    //         id: { type: new GraphQLNonNull(GraphQLID) },
    //         title: { type: GraphQLString },
    //         description: { type: GraphQLString }
    //     },
    //     resolve(parentValue, { id, title, description }) {
    //         return ( Movie.findByIdAndUpdate(id, { title, description }, {new: true}, obj => obj))
    //     }
    // },
    // deleteMovie: {
    //     type: MovieType,
    //     args: {
    //         id: { type: new GraphQLNonNull(GraphQLID) }
    //     },
    //     resolve(parentValue, { id }) {
    //         return (Movie.findByIdAndRemove(id, {new: false}, (obj) => {
    //             return obj;
    //         }))
    //     }
    // }
    }
})

module.exports = new GraphQLSchema({
    query: RootQueryType,
    mutation
});
