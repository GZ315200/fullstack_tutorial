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

### 编写出你的解析器

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
目前，我们已经修改好了，利用分页方式查询发射器信息列表。让我们来测试一下吧
重启命令`npm start`,在playgroud里输入下列代码

```GraphQL
query GetLaunches {
  launches(pageSize: 3) {
    launches {
      id
      mission {
        name
      }
    }
  }
}
```
聪明的你会发现，返回数据里有3条分页数据

### 编写针对类型的解析器

需要注意的是，你可以为schema中的任何类型编写解析器，而不仅仅是查询和更新数据。这就是GraphQL如此灵活的原因。

你可能注意到，我们还没有为类型编写解析器但仍然能运行，是因为GraphQL具有默认解析器； 因此，如果父对象具有相同名称的属性，则不必为字段编写解析器。

来看一个例子，定位到`src/resolvers.js`,并且将这段解析器代码粘贴到Query类型的map里

***src/resolvers.js***

```javascript
Mission: {
  // make sure the default size is 'large' in case user doesn't specify
  missionPatch: (mission, { size } = { size: 'LARGE' }) => {
    return size === 'SMALL'
      ? mission.missionPatchSmall
      : mission.missionPatchLarge;
  },
},
```
***src/schema.js***

```javascript
 type Mission {
    # ... with rest of schema
    missionPatch(mission: String, size: PatchSize): String
  }
```

传入解析器的第一个参数是父参数，它引用了mission对象。第二个参数是传递给`missionPatch`字段的大小，我们使用它来确定我们希望字段解析的mission对象的属性。

现在我们已经知道了如何在查询和任务之外的类型上添加解析器，接下来让我们对`Launch`和U`ser`类型添加更多的解析器。将此代码复制到你的解析器映射中

***src/resolvers.js***

```javascript
 Launch: {
  isBooked: async (launch, _, { dataSources }) =>
    dataSources.userAPI.isBookedOnLaunch({ launchId: launch.id }),
},
User: {
  trips: async (_, __, { dataSources }) => {
    // get ids of launches by user
    const launchIds = await dataSources.userAPI.getLaunchIdsByUser();

    if (!launchIds.length) return [];

    // look up those launches by their ids
    return (
      dataSources.launchAPI.getLaunchesByIds({
        launchIds,
      }) || []
    );
  },
},
```

你可能想知道我们从哪里获得用户来获取他们预定的发射器。好眼力！！！
我们仍然需要验证我们的用户，在下一节中，我们将学习如何对用户进行身份验证并将用户信息附加到上下文中，然后再讨论`Mutation`解析器。

### 验证用户

访问控制是一个功能，几乎每个应用程序将不得不处理。在本教程中，我们将重点讲解用户身份验证的基本概念，而不是具体的实现。
以下是你需要遵循的步骤：

1. 每当GraphQL操作API时，就会使用请求对象调用ApolloServer实例上的上下文函数。使用此请求对象读取授权头。
2. 在上下文函数中对用户进行身份验证
3. 对用户进行身份验证后，将该用户附加到从上下文函数返回的对象上。这允许我们从我们的数据源和解析器中读取用户的信息，因此我们可以授权他们是否可以访问数据。

我们打开`src/index.js`，将ApolloServer上的`上下文函数`更新为如下代码:

***src/index.js***

```javascript
 const isEmail = require('isemail');

const server = new ApolloServer({

  context: async ({ req }) => {
    // simple auth check on every request
    const auth = req.headers && req.headers.authorization || '';
    const email = Buffer.from(auth, 'base64').toString('ascii');

    if (!isEmail.validate(email)) return { user: null };

    // find a user by their email
    const users = await store.users.findOrCreate({ where: { email } });
    const user = users && users[0] || null;

    return { user: { ...user.dataValues } };
  },
  // .... with the rest of the server object code below, typeDefs, resolvers, etc....
```
就像上面概述的步骤一样，我们检查请求上的授权头，通过在数据库中查找用户的凭证对用户进行身份验证，并将用户附加到上下文。虽然我们并不提倡在生产环境中使用这个特定的实现，因为它并不安全，但是这里列出的所有概念都可以应用到如何在实际应用程序中实现身份验证。

我们如何创建传递到`authorization头`的令牌？ 让我们继续下一部分，以便我们可以为登录编写mutation解析器。

### 编写Mutation解析器

编写`Mutation` 解析器程序类似于我们已经编写的`Mutation `解析器程序。首先，让我们编写`login`解析器来完成身份验证流。将下面的代码添加到`Query`解析器下面的解析器映射中

***src/resolvers.js***

```javascript
 Mutation: {
  login: async (_, { email }, { dataSources }) => {
    const user = await dataSources.userAPI.findOrCreateUser({ email });
    if (user) return Buffer.from(email).toString('base64');
  }
},
```
`login`解析器接收电子邮件地址，如果用户存在，则返回令牌。在后面的部分中，我们将学习如何在客户端上保存令牌。

现在，让我们将bookTrips和cancelTrip的解析器添加到Mutation

***src/resolvers.js***

```javascript
Mutation: {
  bookTrips: async (_, { launchIds }, { dataSources }) => {
    const results = await dataSources.userAPI.bookTrips({ launchIds });
    const launches = await dataSources.launchAPI.getLaunchesByIds({
      launchIds,
    });

    return {
      success: results && results.length === launchIds.length,
      message:
        results.length === launchIds.length
          ? 'trips booked successfully'
          : `the following launches couldn't be booked: ${launchIds.filter(
              id => !results.includes(id),
            )}`,
      launches,
    };
  },
  cancelTrip: async (_, { launchId }, { dataSources }) => {
    const result = await dataSources.userAPI.cancelTrip({ launchId });

    if (!result)
      return {
        success: false,
        message: 'failed to cancel trip',
      };

    const launch = await dataSources.launchAPI.getLaunchById({ launchId });
    return {
      success: true,
      message: 'trip cancelled',
      launches: [launch],
    };
  },
},
```

`bookTrips`和`cancelTrip`都必须从模式返回`TripUpdateResponse`类型上指定的属性，该模式包含一个成功指示器、一条状态消息和一个我们已经预订或取消的`launches`数组。bookTrips 的更新可能会变得棘手，因为我们必须考虑部分成功，其中一些启动可能被预订，而另一些可能失败。现在，我们只需简单地在消息字段中表示部分成功。

### 在playground里运行mutations

GraphQL mutations的结构与查询完全相同，只是它们使用mutation关键字。 让我们复制下面的mutation并在操场上运行：

```GraphQL
mutation LoginUser {
  login(email: "daisy@apollographql.com")
}
```
返回的字符串应该是这样的:ZGFpc3lAYXBvbGxvZ3JhcGhxbC5jb20=。复制那个字符串，因为我们需要它来进行下一次mutation操作。

现在，让我们试着预订一些旅行。然而，只有经过授权的用户才能预订行程。幸运的是，playground有一个部分，我们可以在其中粘贴以前的mutation的authorization头，以验证我们的用户身份。首先，把这个mutation粘贴到playground上

```GraphQL
mutation BookTrips {
  bookTrips(launchIds: [67, 68, 69]) {
    success
    message
    launches {
      id
    }
  }
}
```
接下来，将我们的authorization头粘贴到底部的HTTP Headers中
```JSON
{
  "authorization": "ZGFpc3lAYXBvbGxvZ3JhcGhxbC5jb20="
}
```
然后，运行mutation。你应该会看到一条成功消息，以及我们刚刚预订mutation的id。在playground上手工测试mutation是检查我们的API的好方法，但是在实际应用程序中，我们应该运行自动化测试，这样我们才能安全地重构代码。在下一节中，你将实际了解如何在生产环境中运行Graph，而不是测试Graph。



- [上一页](./hook_up_datasource.md)   [下一页](./graph_resolvers.md)
