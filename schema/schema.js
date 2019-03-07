const graphql = require('graphql');
const get = require('lodash/get');
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
const ShippingProvider = require('../models/shippingProvider');
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

const OrderProductsProduct = getProductType('OrderProductsProduct');
const OrderProducts = new GraphQLObjectType({
  name: 'OrderProducts',
  fields: {
    title: { type: GraphQLString },
    amount: { type: GraphQLInt },
    price: { type: GraphQLFloat },
    total: { type: GraphQLFloat },
    product: { type: OrderProductsProduct },
  }
});
const UserOfOrder = getUserType('UserOfOrder');
const OrderStatus = new GraphQLEnumType({ name: 'OrderStatus', values: { 
  NEW: { value: 'NEW' },
  PAID: { value: 'PAID' },
  SENT: { value: 'SENT' },
  RECEIVED: { value: 'RECEIVED' },
  CANCELLED: { value: 'CANCELLED' },
}});
const OrderShippingProvider = new GraphQLObjectType({
  name: 'OrderShippingProvider',
  fields: {
    name: { type: GraphQLString },
    optionName: { type: GraphQLString },
    price: { type: GraphQLFloat },
    shippingProvider: { type: getShippingProviderType('OrderShippingProviderProvider')}
  }
})
function getOrderType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      total: { type: GraphQLFloat },
      totalWithShipping: { type: GraphQLFloat },
      status: { type: GraphQLString },
      products: { type: new GraphQLList(OrderProducts) },
      user: { type: UserOfOrder },
      shippingProvider: { type: OrderShippingProvider },
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

function getShippingProviderType(name) {
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
const ShippingProviderType = getShippingProviderType('ShippingProvider')

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
    ShippingProviders: {
      type: new GraphQLList(ShippingProviderType),
      resolve() {
          return ShippingProvider.find({});
      }
    },
    ShippingProvider: {
      type: ShippingProviderType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return ShippingProvider.findById(id);
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
        ShippingProviderId: { type: new GraphQLNonNull(GraphQLID) },
        //======================
        // remove thos field in future, resolve with user token
        //======================
        userId: { type: new GraphQLNonNull(GraphQLID) },
        //======================
        // remove thos field in future, resolve with user token
        //======================
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
      resolve: async (parentValue, { userId, orderProducts, ShippingProviderId }) => {
        try {
          const productIds = orderProducts.map(({ id }) => id);
          const [user, dbProducts] = await Promise.all([
            await User.findById(userId),
            await Product.find({ _id: { $in: productIds }}),
          ]);
          if (user && dbProducts && dbProducts.length === productIds.length) {
            const products = dbProducts.map(product => {
              const amount = orderProducts.find(({ id }) => id === product.id).amount;
              const total = amount * product.price;
              return {
                amount,
                total,
                product,
                title: product.title.en,
                price: product.price,
              };
            })
            const total = products.reduce((acc, product) => (acc + product.total), 0);
            const shippingProvider = await ShippingProvider.findById(ShippingProviderId);
            const cheapestOption = shippingProvider.options.reduce((minOption, option) => (minOption.price < option.price ? minOption : option), shippingProvider.options[0]);
            const order = await new Order({
              total,
              products,
              user,
              status: 'NEW',
              totalWithShipping: total + cheapestOption.price,
              shippingProvider: {
                shippingProvider,
                name: shippingProvider.name,
                optionName: cheapestOption.name,
                price: cheapestOption.price,
              },
            }).save();
            return { order };
          }
          return { order: null };
        } catch {
          return { order: null };
        }
      }
    },
    addShippingProvider: {
      type: new GraphQLObjectType({ name: 'NewShippingProvider', fields: { ShippingProvider: { type: ShippingProviderType } } }),
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
        const ShippingProvider = await new ShippingProvider({ name, address, options}).save();
        return { ShippingProvider };
      },
    },
  }
})

module.exports = new GraphQLSchema({
    query: RootQueryType,
    mutation
});
