- [主页](../README.md)

# 写你的graph resolvers
## 学习如何使用GraphQL 查询数据


OK，到目前为止，我们的Graph API还不能算起到作用。你需要借助，graph resolveer 方式去触发你的业务逻辑。如：查询或者更新操作

### 什么是resolver？
`Resolvers`提供将GraphQL操作（查询，变异或订阅）转换为数据的说明。 它们要么返回我们在架构中指定的相同类型的数据，要么返回对该数据的Promise。
在开始编写解析器之前，我们需要了解更多关于解析器功能的外观。 解析程序函数接受四个参数：

```javascript
fieldName: (parent, args, context, info) => data;
```
`parent:`包含从解析器返回的父类型上的结果的对象
`args:`包含传递给字段的参数的对象
`context:`:GraphQL操作中所有解析器共享的对象。 我们使用上下文包含每个请求状态（例如身份验证信息）并访问我们的数据源。
`info:`有关操作执行状态的信息，仅在高级情况下才应使用

还记得我们在上一节中创建并传递给`ApolloServer`的`context`属性的`LaunchAPI`和`UserAPI`数据源吗？ 我们将通过访问`context`参数在解析器中调用它们。

让我们开始吧！！

### 连接解析器到Apollo Server

首先，让我们将解析器映射连接到`Apollo Server`。 现在，它只是一个空对象，但是我们应该将其添加到`ApolloServer`实例中，这样我们以后就不必再执行它了。 导航到`src/index.js`并将以下代码添加到文件中：

***src/index.js***

```javascript
const { ApolloServer } = require('apollo-server');
const typeDefs = require('./schema');
const { createStore } = require('./utils');

const resolvers = require('./resolvers');

const LaunchAPI = require('./datasources/launch');
const UserAPI = require('./datasources/user');

const store = createStore();

const server = new ApolloServer({
  typeDefs,

  resolvers,
  dataSources: () => ({
    launchAPI: new LaunchAPI(),
    userAPI: new UserAPI({ store })
  })
});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
```
加入之后Apollo Server会自动执行我们的解析器。

### 写出你的查询的解析器

首先，让我们为查询类型上的，launches, launche, me编写查询解析器
我们将解析器构建到一个映射中，其中的键对应于schema中的类型和字段。 如果你想记住类型上的哪些字段，可以随时检查Graph API的schema。

***src/resolvers.js***
```javascript
module.exports = {
  Query: {
    launches: (_, __, { dataSources }) =>
      dataSources.launchAPI.getAllLaunches(),
    launch: (_, { id }, { dataSources }) =>
      dataSources.launchAPI.getLaunchById({ launchId: id }),
    me: (_, __, { dataSources }) => dataSources.userAPI.findOrCreateUser()
  }
};
```

上面的代码展示了对Query的解析器，类型字段有：`launches`, `launch`, `me`. 第一个参数是指向最高级解析器，`parent`,它总是空，是因为它指向我们graoh的根。第二个参数是指向进入我们查询的任意一个参数，我们使用id这个参数来拉取launch的数据。最后，我们从第三个参数析构我们的dataSource，是利用上下文，在解析器里调用方法。


### 在playgroud里运行你的查询

在 server 目录下使用命令`npm start`,启动后在浏览器里输入 http://localhost:4000/ 查看playground页面

copy下列的查询代码

```GraphQL
# 查询所有的发射器
query GetLaunches {
  launches {
    id
    mission {
      name
    }
  }
}
# 通过ID查询发射器，写法如下，此方法采用硬编码的方式。
query GetLaunchById {
  launch(id: 60) {
    id
    rocket {
      id
      type
    }
  }
}
# ID可以通过参数进行传递。传入 { "id": 60 } 参数在playgroud的左下角
query GetLaunchById($id: ID!) {
  launch(id: $id) {
    id
    rocket {
      id
      type
    }
  }
}

```

### 分页查询

`Pagination` 是保证数据以小数据块的方式进行传递的解决方案。
推荐使用基于游标的分页方式。在基于游标的分页中，使用常量指针（或游标）来跟踪应从中提取下一项的数据集中的位置。

粘贴下列代码到`src/schema.js`中,增加新的类型`LaunchConnection`作为schema的返回数据体

***src/schema.js***

```javascript
type Query {
  launches( # replace the current launches query with this one.
    """
    The number of results to show. Must be >= 1. Default = 20
    """
    pageSize: Int
    """
    If you add a cursor here, it will only return results _after_ this cursor
    """
    after: String
  ): LaunchConnection!
  launch(id: ID!): Launch
  me: User
}

"""
Simple wrapper around our list of launches that contains a cursor to the
last item in the list. Pass this cursor to the launches query to fetch results
after these.
"""
type LaunchConnection { # add this below the Query type as an additional type.
  cursor: String!
  hasMore: Boolean!
  launches: [Launch]!
}
```

编写完毕后，打开`src/utils.js`文件, 找到`paginateResults`这个方法，此方法就是可以帮助我们对服务器返回的数据进行分页。接下来，我们要更新resolver.js的方法，使用`paginateResults`方法进行替换。

***src/resolvers.js***
```javascript
const { paginateResults } = require('./utils');

module.exports = {
  Query: {

    launches: async (_, { pageSize = 20, after }, { dataSources }) => {
      const allLaunches = await dataSources.launchAPI.getAllLaunches();
      // we want these in reverse chronological order
      allLaunches.reverse();
      const launches = paginateResults({
        after,
        pageSize,
        results: allLaunches
      });
      return {
        launches,
        cursor: launches.length ? launches[launches.length - 1].cursor : null,
        // if the cursor of the end of the paginated results is the same as the
        // last item in _all_ results, then there are no more results after this
        hasMore: launches.length
          ? launches[launches.length - 1].cursor !==
            allLaunches[allLaunches.length - 1].cursor
          : false
      };
    },
    launch: (_, { id }, { dataSources }) =>
      dataSources.launchAPI.getLaunchById({ launchId: id }),
     me: async (_, __, { dataSources }) =>
      dataSources.userAPI.findOrCreateUser(),
  }
};
```



首先，

- [上一页](./hook_up_datasource.md)   [下一页](./graph_resolvers.md)
