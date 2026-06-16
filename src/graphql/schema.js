const { gql } = require('graphql-tag');

const typeDefs = gql`
  type User {
    id: String!
    name: String!
    email: String!
    role: String!
    department: String!
    avatar: String
    isActive: Boolean!
    apiKey: String
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type PaginatedUsers {
    data: [User!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  type Query {
    users(department: String, role: String, page: Int, limit: Int): PaginatedUsers!
    user(id: String!): User
    me: User
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createUser(name: String!, email: String!, password: String!, role: String!, department: String!): User!
    updateUser(id: String!, name: String, email: String, role: String, department: String, isActive: Boolean): User!
    deleteUser(id: String!): Boolean!
    resetData: Boolean!
  }
`;

module.exports = { typeDefs };
