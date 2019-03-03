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
  GraphQLFloat } = graphql;
const User = require('../models/user');
const Order = require('../models/order');
const Product = require('../models/product');
const bcrypt = require('bcrypt');
const saltRounds = 10;

function getUserType() {
  return new GraphQLObjectType({
      name: 'User',
      fields: () => ({
          id: { type: GraphQLID },
          username: { type: GraphQLString },
          email: { type: GraphQLString },
          password: { type: GraphQLString },
          orders: {
              type: new GraphQLList(getOrderType()),
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

function getOrderType() {
  return new GraphQLObjectType({
      name: 'Order',
      fields: () => ({
          id: { type: GraphQLID },
          total: { type: GraphQLFloat },
          totalWithShipping: { type: GraphQLFloat },
          shippingCost: { type: GraphQLFloat },
          status: { type: GraphQLString },
          products: { type: new GraphQLList( new GraphQLObjectType({
            name: 'orderProducts',
            fields: {
              title: { type: GraphQLString },
              amount: { type: GraphQLInt },
              price: { type: GraphQLFloat },
              total: { type: GraphQLFloat },
            }
          })),
          user: {
            type: getUserType(),
            resolve(parentValue) {
                const userId = parentValue.user.id.toString('hex');
                return Order.findById(userId);
            }
          }
        },
      })
  });
}

function getProductType() {
  return new GraphQLObjectType({
      name: 'Product',
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

const UserType = getUserType();
const OrderType = getOrderType();
const ProductType = getProductType();

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
    }
  })
});

const mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
        addUser: {
          type: UserType,
          args: {
              username: { type: new GraphQLNonNull(GraphQLString) },
              email: { type: new GraphQLNonNull(GraphQLString)},
              password: { type: new GraphQLNonNull(GraphQLString)},
          },
          resolve(parentValue, { username, email, password }) {
            bcrypt.hash(password, saltRounds, (err, hash) => {
              new User({ username, email, password: hash }).save();
            });
          }
        },
        addProduct: {
          type: ProductType,
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
          resolve(parentValue, args) {
            const dbArgs = {};
            Object.keys(args).forEach((key) => {
              dbArgs[key] = args[key];
            });
            new Product(dbArgs).save();
          }
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
