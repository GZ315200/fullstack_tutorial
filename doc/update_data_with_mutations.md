- [主页](../README.md)

# 使用mutations更新数据
## 学习如何使用useMutation hook更新数据

接下来我们将学习如何使用useMutation hook来进行用户的登陆


## 什么是useMutation hook

useMutation hook和useQuery一样都是来自@apollo/react-hooks。主要不同的是useMutation是用来更改数据

## 使用useMutation更新数据

第一步构建我们的GraphQL mutation。让我们导航到`src/pages/login.js`,并copy下列代码

***src/pages/login.js***

```javascript
import React from 'react';
import { useApolloClient, useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { LoginForm, Loading } from '../components';

const LOGIN_USER = gql`
  mutation login($email: String!) {
    login(email: $email)
  }
`;
```

接着让我们使用useMutation hook更新数据

***src/pages/login.js***
```javascript
export default function Login() {
  const [login, { data }] = useMutation(LOGIN_USER);
  return <LoginForm login={login} />;
}
```

为了给我们的用户创造更好的体验，我们希望在会话之间保持登录状态。 为此，我们需要将登录令牌保存到localStorage。 让我们学习如何使用useMutation的onCompleted处理程序来保持登录状态：

### 用useApolloClient暴露Apollo Client

useApolloClient Hook 可以帮助我们访问客户端。
首先，让我们调用useApolloClient来获取当前已配置的客户端实例。接下来，我们像通过一个onCompleted的回调useMutation，同样我们在该回调里保存登陆token在localStorage里
我们在此次调用中也会使用到client.writeData方法将本地数据写入Apollo缓存中，用于标示用户已经登陆了。OK，来看看例子吧：

***src/pages/login.js***

```javascript
export default function Login() {

  const client = useApolloClient();
  const [login, { loading, error }] = useMutation(
    LOGIN_USER,
    {
      onCompleted({ login }) {
        localStorage.setItem('token', login.token);
        client.writeData({ data: { isLoggedIn: true } });
      }
    }
  );

  if (loading) return <Loading />;
  if (error) return <p>An error occurred</p>;

  return <LoginForm login={login} />;
}

```

### 粘贴token信息到authorization报头去请求信息

我们将token信息粘贴带authorization报头内，然后请求后端数据。
我们将下列代码粘贴到src/index.js内，并替换之前对的client实例化方式，增加携带报头
authorization的请求方式

***src/index.js***

```javascript
const client = new ApolloClient({
  cache,
  link: new HttpLink({
    uri: 'http://localhost:4000/graphql',

    headers: {
      authorization: localStorage.getItem('token'),
    },
  }),
});

cache.writeData({
  data: {
    isLoggedIn: !!localStorage.getItem('token'),
    cartItems: [],
  },
});
```

指定headers项，并增加localStorage来保存token信息。




- [上一页](./fetch_data_with_queries.md)   [下一页](./manage_local_state.md)
