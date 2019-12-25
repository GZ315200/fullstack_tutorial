import { ApolloClient } from "apollo-client";
import { InMemoryCache } from "apollo-cache-inmemory";
import { HttpLink } from "apollo-link-http";
import { ApolloProvider } from "@apollo/react-hooks";
import React from "react";
import ReactDOM from "react-dom";
import Pages from "./pages";

const cache = new InMemoryCache();
const link = new HttpLink({
  uri: "http://localhost:4000/graphql",
  headers: { authorization: localStorage.getItem("token") }
});

const client = new ApolloClient({
  cache,
  link: link
});

cache.writeData({
  data: {
    isLoggedIn: !!localStorage.getItem('token'),
    cartItems: [],
  },
});
// 测试后端服务是否正常
// client.query({
//   query: gql`
//     query GetLaunch {
//       launch(id: 56) {
//         id
//         mission {
//           name
//         }
//       }
//     }
//   `
// })
// .then(result => console.log(result));

ReactDOM.render(
  <ApolloProvider client={client}>
    <Pages />
  </ApolloProvider>,
  document.getElementById("root")
);
