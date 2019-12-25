- [主页](../README.md)
# 管理本地状态
## 如何在Apollo缓存中存储和查询本地数据

在我们几乎构建的每个应用程序中，我们都会显示来自Graph API的远程数据和本地数据（例如网络状态，表单状态等）的组合。 Apollo Client的出色之处在于它允许我们将本地数据存储在Apollo缓存中，并使用GraphQL在远程数据旁边查询它。

我们建议您在Apollo缓存中管理本地状态，而不是引入另一个状态管理库（例如Redux），这样Apollo缓存可以成为事实的单一来源。

使用Apollo Client管理本地数据与本教程中已经管理远程数据的方式非常相似。 你将为本地数据编写一个客户端模式和解析器。你还可以通过指定@client指令来学习使用GraphQL查询它。 让我们深入挖掘一下！

## 编写一个本地schema

导航到`src/resolvers.js`并复制以下代码以创建你的客户端schema

***src/resolvers.js***

```javascript
import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    isLoggedIn: Boolean!
    cartItems: [ID!]!
  }

  extend type Launch {
    isInCart: Boolean!
  }

  extend type Mutation {
    addOrRemoveFromCart(id: ID!): [Launch]
  }
`;

export const resolvers = {};
```

为了构建客户机schema，我们扩展了服务器schema的类型，并使用gql函数包装它。使用extend关键字允许我们在开发人员工具(如Apollo VSCode和Apollo DevTools)中组合这两个模式。
我们还可以通过从服务器扩展类型向服务器数据添加本地字段。这里，我们将`isInCart`本地字段添加到从`Graph API`接收回来的启动类型。

## 初始化存储

现在我们已经创建了客户端schema，接下来让我们学习如何初始化存储。由于查询是在组件挂载时执行的，所以我们必须使用一些默认状态来预热一下Apollo缓存，这样那些查询就不会出错。我们需要为isLoggedIn和cartItems向缓存写入初始数据

返回`src/index.js`并注意，我们已经在上一节中添加了`cache.writeData`调用来准备缓存。 当我们在这里时，请确保还导入我们刚刚创建的typeDef和解析器，以便我们以后可以使用它们：

***src/index.js***
```javascript
import { resolvers, typeDefs } from './resolvers';

const client = new ApolloClient({
  cache,
  link: new HttpLink({
    uri: 'http://localhost:4000/graphql',
    headers: {
      authorization: localStorage.getItem('token'),
    },
  }),

  typeDefs,
  resolvers,
});

cache.writeData({
  data: {
    isLoggedIn: !!localStorage.getItem('token'),
    cartItems: [],
  },
});
```

现在，我们已经向Apollo缓存添加了默认状态，让我们学习如何从React组件中查询本地数据。

### 查询本地数据
从Apollo缓存中查询本地数据与从Graph API中查询远程数据几乎是一样的。惟一的区别是，您将@client指令添加到本地字段，以告诉Apollo客户端从缓存中提取它。

让我们来看一个示例，在这个示例中，我们查询了在上次的`Mutation`练习中写入缓存的isLoggedIn字段。

***src/index.js***

```javascript
import { ApolloProvider, useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import Pages from './pages';
import Login from './pages/login';
import injectStyles from './styles';


const IS_LOGGED_IN = gql`
  query IsUserLoggedIn {
    isLoggedIn @client
  }
`;

function IsLoggedIn() {

  const { data } = useQuery(IS_LOGGED_IN);
  return data.isLoggedIn ? <Pages /> : <Login />;
}

injectStyles();
ReactDOM.render(
  <ApolloProvider client={client}>
    <IsLoggedIn />
  </ApolloProvider>,
  document.getElementById('root'),
);
```

首先，我们通过将`@client`指令添加到`isLoggedIn`字段来创建`IsUserLoggedIn`本地查询。然后，我们使用`useQuery`渲染一个组件，传递我们的本地查询，并根据响应渲染登录屏幕或主页(取决于用户是否登录)。由于缓存读取是同步的，我们不必考虑任何加载状态。

让我们看一下在`src/pages/cart.js`中查询本地状态的组件的另一个示例。 和以前一样，我们创建查询：


***src/pages/cart.js***
```javascript
import React, { Fragment } from 'react';
import { useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { Header, Loading } from '../components';
import { CartItem, BookTrips } from '../containers';

export const GET_CART_ITEMS = gql`
  query GetCartItems {
    cartItems @client
  }
`;
```
接下来，我们调用`useQuery`并将其绑定到`GetCartItems`查询

需要注意的是，你可以在一个单独的GraphQL文档中混合本地查询和远程查询。接下来让我们学习如何将本地字段添加到服务器数据中。

### 向服务器数据添加虚拟字段

使用Apollo Client管理本地数据的独特优势之一是，你可以将虚拟字段添加到从Graph API返回的数据中。 这些字段仅在客户端上存在，对于用本地状态渲染服务器数据很有用。 在我们的示例中，我们将向我们的启动类型添加一个isInCart虚拟字段。
不用粘贴，我们已经定义过了
***src/resolvers.js***

```javascript
import gql from 'graphql-tag';

export const schema = gql`
  extend type Launch {
    isInCart: Boolean!
  }
`;
```
接下来，在`Launch`类型上指定一个客户端解析器，以告诉`Apollo Client`如何解析您的虚拟字段：

***src/resolvers.js***

```javascript
export const resolvers = {
  Launch: {
    isInCart: (launch, _, { cache }) => {
      const { cartItems } = cache.readQuery({ query: GET_CART_ITEMS });
      return cartItems.includes(launch.id);
    },
  },
};
```

现在，你可以在`Launch`详细信息页面上查询您的虚拟字段！ 与前面的示例类似，只需将虚拟字段添加到查询中并指定`@client`指令。

***src/pages/launch.js***

```javascript
export const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {

      isInCart @client
      site
      rocket {
        type
      }
      ...LaunchTile
    }
  }
  ${LAUNCH_TILE_DATA}
`;
```

### 使用本地数据

目前我们已经学习了Apollo客户端的缓存机制，Apollo客户端同样支持两种更新本地数据的方式，`direct cache writes` or `client resolvers`.

- `直接写入`: 典型一些简单的数据缓存，如boolean和string
- `客户端解析器`: 存储一些复杂的写入，如何从列表增加或者移除数据

#### Direct cache writes

让我们看一个类似的例子，在这里我们复制下面的代码以创建一个注销按钮：

***src/containers/logout-button.js***

```javascript
import React from 'react';
import styled from 'react-emotion';
import { useApolloClient } from '@apollo/react-hooks';

import { menuItemClassName } from '../components/menu-item';
import { ReactComponent as ExitIcon } from '../assets/icons/exit.svg';

export default function LogoutButton() {
  const client = useApolloClient();
  return (
    <StyledButton
      onClick={() => {

        client.writeData({ data: { isLoggedIn: false } });
        localStorage.clear();
      }}
    >
      <ExitIcon />
      Logout
    </StyledButton>
  );
}

const StyledButton = styled('button')(menuItemClassName, {
  background: 'none',
  border: 'none',
  padding: 0,
});
```

我们还可以在useMutation Hook的update函数中执行直接写入。 更新功能使我们可以在发生更新后手动更新缓存，而无需重新获取数据。 让我们看一下`src/containers/book-trips.js`中的示例：

***src/containers/book-trips.js***

```javascript
import React from 'react';
import { useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import Button from '../components/button';
import { GET_LAUNCH } from './cart-item';

const BOOK_TRIPS = gql`
  mutation BookTrips($launchIds: [ID]!) {
    bookTrips(launchIds: $launchIds) {
      success
      message
      launches {
        id
        isBooked
      }
    }
  }
`;

export default function BookTrips({ cartItems }) {
  const [bookTrips, { data, loading, error }] = useMutation(
    BOOK_TRIPS,
    {
      refetchQueries: cartItems.map(launchId => ({
        query: GET_LAUNCH,
        variables: { launchId },
      })),

      update(cache) {
        cache.writeData({ data: { cartItems: [] } });
      }
    }
  )
  return data && data.bookTrips && !data.bookTrips.success
    ? <p data-testid="message">{data.bookTrips.message}</p>
    : (
      <Button onClick={bookTrips} data-testid="book-button">
        Book All
      </Button>
    );
}
```

#### 本地解析器

 如果我们想执行更复杂的本地数据更新，例如从列表中添加或删除列表，该怎么办？ 对于这种情况，我们将使用本地解析器。 本地解析器具有与远程解析器相同的功能标签（((parent, args, context, info) => data).。 唯一的区别是，Apollo缓存已为你添加到上下文中。 在解析器内部，将使用缓存读取和写入数据。

然后我们实现一个`addOrRemoveFromCart`的mutation

***src/resolvers.js***

```javascript
export const resolvers = {
  Mutation: {
    addOrRemoveFromCart: (_, { id }, { cache }) => {
      const { cartItems } = cache.readQuery({ query: GET_CART_ITEMS });
      const data = {
        cartItems: cartItems.includes(id)
          ? cartItems.filter(i => i !== id)
          : [...cartItems, id],
      };
      cache.writeQuery({ query: GET_CART_ITEMS, data });
      return data.cartItems;
    },
  },
};
```

在此解析器中，我们从上下文中解构Apollo缓存，以便读取获取购物车项目的查询。 获得购物车数据后，我们将删除或将传递给Mutation的购物车商品的ID添加到列表中。 最后，我们从Mutation中返回更新的列表。

让我们看看如何在组件中调用addOrRemoveFromCart：

***src/containers/action-button.js***

```javascript
import gql from 'graphql-tag';

const TOGGLE_CART = gql`
  mutation addOrRemoveFromCart($launchId: ID!) {
    addOrRemoveFromCart(id: $launchId) @client
  }
`;
```

现在，我们的本地的Mutation已经完成，让我们构建其余的ActionButton组件，以便完成构建购物车：

***src/containers/action-button.js***

```javascript
import React from 'react';
import { useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { GET_LAUNCH_DETAILS } from '../pages/launch';
import Button from '../components/button';

export const TOGGLE_CART = gql`
  mutation addOrRemoveFromCart($launchId: ID!) {
    addOrRemoveFromCart(id: $launchId) @client
  }
`;

const CANCEL_TRIP = gql`
  mutation cancel($launchId: ID!) {
    cancelTrip(launchId: $launchId) {
      success
      message
      launches {
        id
        isBooked
      }
    }
  }
`;

export default function ActionButton({ isBooked, id, isInCart }) {
  const [mutate, { loading, error }] = useMutation(
    isBooked ? CANCEL_TRIP : TOGGLE_CART,
    {
      variables: { launchId: id },
      refetchQueries: [
        {
          query: GET_LAUNCH_DETAILS,
          variables: { launchId: id },
        },
      ]
    }
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>An error occurred</p>;

  return (
    <div>
      <Button
        onClick={mutate}
        isBooked={isBooked}
        data-testid={'action-button'}
      >
        {isBooked
          ? 'Cancel This Trip'
          : isInCart
          ? 'Remove from Cart'
          : 'Add to Cart'}
      </Button>
    </div>
  );
}
```

在这个例子中，我们使用isBooked prop传入组件，就像远程mutation是一样，我们可以使用useMutation Hook操作我们的本地数据。


# 说在后面
  恭喜大家，🎉🎉. 完成了所有的教程。在这里希望你能更深入的理解和编写核心知识点的代码。了解其原理。你才能真正的做到融会贯通。

- [上一页](./update_data_with_mutations.md)
