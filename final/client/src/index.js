
import { ApolloClient } from "apollo-client";
import { InMemoryCache } from "apollo-cache-inmemory";
import { HttpLink } from "apollo-link-http";
import gql from "graphql-tag";
import { ApolloProvider } from '@apollo/react-hooks';
import React from 'react';
import ReactDOM from 'react-dom';
import Pages from './pages';


const cache = new InMemoryCache();
const link = new HttpLink({
  uri: "http://localhost:4000/"
});

const client = new ApolloClient({
  cache,
  link
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
    </ApolloProvider>, document.getElementById('root')
)
