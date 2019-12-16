
- [主页](../README.md)

# 连接你的数据源
## 连接REST和SQL数据
现在，我们已经构建了`Schema`，我们需要将数据源连接到GraphQL API。 GraphQL API非常灵活，因为您可以将它们放在任何服务之上，包括任何业务逻辑，REST API，数据库或gRPC服务。

Apollo使用我们的数据源API使将这些服务连接到你的GraphQL变得简单。 Apollo数据源是一个类，它封装了特定服务的所有数据提取逻辑以及缓存和重复数据删除。 通过使用Apollo数据源将服务连接到Graph API，你还将遵循最佳实践来组织代码。

在下一部分中，我们将为REST API和SQL数据库构建数据源，并将它们连接到Apollo Server。 如果你不熟悉这些技术中的任何一种，请不要担心，你无需为了理解示例而深入了解它们。 😀

### 连接REST API
首先，让我们连接Space-X v2 Rest API到你的Graph。我们需要先下载`apollo-datasource-rest`,如果已经安装了，可以忽略

```shell
npm install apollo-datasource-rest --save
```

这个包，暴露了`RESTDataSource`负责从REST API抓取数据类。OK，现在，让我们继承这个类并定义`this.baseURL`
在我们这个例子里，baseURL是`https://api.spacexdata.com/v2/`,让我们来创建我们的`LaunchAPI`在下面的代码里

***src/datasources/launch.js***

```javascript
const { RESTDataSource } = require('apollo-datasource-rest');

class LaunchAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = 'https://api.spacexdata.com/v2/';
  }
}

module.exports = LaunchAPI;
```

Apollo `RESTDataSource`还设置了内存缓存，无需额外设置即可缓存来自REST资源的响应。 我们称此为部分查询缓存。 此缓存的优点在于，你可以重用REST API公开的现有缓存逻辑。 如果您想了解有关使用Apollo数据源进行部分查询缓存的更多信息，请查看我们的博客文章。

### 写拉取数据的方法

下一步是向`LaunchAPI`数据源添加与我们的Graph API需要获取的查询相对应的方法。 根据我们的架构，我们需要一种方法来获取所有启动。 现在，将一个`getAllLaunches`方法添加到我们的`LaunchAPI`类中：

 ```javascript
async getAllLaunches() {
  const response = await this.get('launches');
  return Array.isArray(response)
    ? response.map(launch => this.launchReducer(launch))
    : [];
}
 ```

Apollo REST数据源具有与`HTTP` (如`GET`和`POST`）相对应的辅助方法。 在上面的代码中，`this.get（'launches'）`向`https://api.spacexdata.com/v2/launches`发出`GET`请求，并将返回的launches存储在响应变量中。 然后，`getAllLaunches`方法映射启动，并使用`this.launchReducer`转换来自REST端点的响应。 如果没有启动，则返回一个空数组。

现在，我们需要编写我们的`launchReducer`方法，以将我们的启动数据转换为我们的`Schema`期望的数据格式。

***src/datasources/launch.js***

```javascript
launchReducer(launch) {
  return {
    id: launch.flight_number || 0,
    cursor: `${launch.launch_date_unix}`,
    site: launch.launch_site && launch.launch_site.site_name,
    mission: {
      name: launch.mission_name,
      missionPatchSmall: launch.links.mission_patch_small,
      missionPatchLarge: launch.links.mission_patch,
    },
    rocket: {
      id: launch.rocket.rocket_id,
      name: launch.rocket.rocket_name,
      type: launch.rocket.rocket_type,
    },
  };
}
```
接下来，让我们添加两个方法，`getLaunchById` and `getLaunchesByIds` 到 `LaunchAPI`


***src/datasources/launch.js***

```javascript
async getLaunchById({ launchId }) {
  const response = await this.get('launches', { flight_number: launchId });
  return this.launchReducer(response[0]);
}

getLaunchesByIds({ launchIds }) {
  return Promise.all(
    launchIds.map(launchId => this.getLaunchById({ launchId })),
  );
}
```
`getLaunchById`方法获取`flight number`并返回特定发射器的数据，而`getLaunchesByIds`根据各自的`launchIds`返回多个发射器。

OK, 我们已经成功连接了REST API。 🎉 🎉 🎉 🎉 接下来，我们开始连接数据库。

### 连接数据库

首先我们的REST API仅是只读的。所以，我们需要连接我们Graph API到数据库，并保存拉取的用户信息。
本教程将SQLite用于我们的SQL数据库，并将Sequelize用于我们的ORM。
我们的`package.json`已经包含了这些软件包.

#### 构建自定义数据源

我们可以使用`apollo-datasource`包创建自己的数据源。

下面有一些创建数据源的核心概念

`initialize` 方法：
如果要将任何配置选项传递给类，则需要实现此方法。 在这里，我们正在使用此方法来访问Graph API的上下文。
`this.context`是在GraphQL请求中的每个解析器之间共享的对象，现在，你只需要知道上下文对于存储用户信息很有用。

缓存：尽管REST数据源带有其自己的内置缓存，但通用数据源却没有。不过你可以使用链接文档教程构建自己的缓存 -> [🔗](https://www.apollographql.com/docs/apollo-server/data/data-sources/#community-data-sources)

OK, 让我们看下创建在`src/datasources/user.js`的方法

`findOrCreateUser({ email }) `: 在数据库中查找或创建具有给定电子邮件的用户
`bookTrips({ launchIds })` : 取得带有launchId数组的对象，并将其预订给登录用户
`cancelTrip({ launchId })`: 获取具有launchId的对象并取消已登录用户的启动
`getLaunchIdsByUser()`: 返回已登录用户的所有预订的发射器
`isBookedOnLaunch({ launchId })`: 确定登录的用户是否预订了某个启动

### 增加数据源到Apollo Server

现在，我们已经构建了我们`LaunchAPI`的数据源，我们需要构建`UserAPI`来连接我们的数据库。

添加我们的数据源很简单。 只需在ApolloServer上创建一个dataSources属性，该属性对应于一个函数，该函数返回带有实例化数据源的对象。 通过导航到`src/index.js`并添加以下代码中

***src/index.js***

```javascript
const { ApolloServer } = require('apollo-server');
const typeDefs = require('./schema');
const { createStore } = require('./utils');
const LaunchAPI = require('./datasources/launch');const UserAPI = require('./datasources/user');
const store = createStore();
const server = new ApolloServer({
  typeDefs,
  dataSources: () => ({    launchAPI: new LaunchAPI(),    userAPI: new UserAPI({ store })  })});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
```


- [上一页](./build_a_schema.md)   [下一页](./hook_up_datasource.md)
