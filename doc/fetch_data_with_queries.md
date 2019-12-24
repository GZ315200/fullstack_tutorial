- [主页](../README.md)

# 查询获取数据
## 了解如何使用useQuery hook获取数据

本节我们将学习如何使用`useQuery hook`来获取复杂的查询数据

## useQuery hook是什么
useQuery Hook是Apollo应用程序最重要的构建模块之一。它是一个React钩子，获取一个GraphQL查询并列出结果，因此你可以根据它返回的数据渲染UI。

## 查询一个列表数据

要使用`useQuery`创建组件，请从`@ apollo / react-hooks`导入`useQuery`，将以g`ql`包装的查询作为第一个参数传递，然后将组件连接起来，以使用结果对象上的`loading`，`data`和`error`属性进行渲染 应用中的用户界面。

首先让我们用GraphQL获取一个发射器的列表。定位到`src/pages/launches.js`,粘贴下列代码到文件内
***src/pages/launches.js***

```javascript
import React, { Fragment } from 'react';
import { useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { LaunchTile, Header, Button, Loading } from '../components';

const GET_LAUNCHES = gql`
  query launchList($after: String) {
    launches(after: $after) {
      cursor
      hasMore
      launches {
        id
        isBooked
        rocket {
          id
          name
        }
        mission {
          name
          missionPatch
        }
      }
    }
  }
`;
```
我们通过`useQuery` hook获取`GET_LAUNCHES`的查询，然后解析出，loading, error, data的值


## 构建一个分页的列表

接下来，我们使用Apollo Client内建的分页插件帮助我们查询进行分页查询
同样我们使用useQuery获取列表数据,但我们这次要获取一个`fetchMore`函数

现在我们有了fetchMore函数，让我们将其连接到“加载更多”按钮，单击时可以获取更多项目。 为此，我们需要在fetchMore的返回对象上指定一个updateQuery函数，该函数告诉Apollo缓存如何使用要获取的新项目更新查询。
复制下面的代码，并将其添加到上一步中添加的render prop函数中的</ Fragment>标记上方。

***src/pages/launches.js***

```javascript
{data.launches &&
  data.launches.hasMore && (
    <Button
      onClick={() =>

        fetchMore({
          variables: {
            after: data.launches.cursor,
          },

          updateQuery: (prev, { fetchMoreResult, ...rest }) => {
            if (!fetchMoreResult) return prev;
            return {
              ...fetchMoreResult,
              launches: {
                ...fetchMoreResult.launches,
                launches: [
                  ...prev.launches.launches,
                  ...fetchMoreResult.launches.launches,
                ],
              },
            };
          },
        })
      }
    >
      Load More
    </Button>
  )
}
`;
```
### 获取单个发射器的数据

让我们定位到`src/pages/launch.js`，copy下列代码
***src/pages/launch.js***

```javascript
import React, { Fragment } from 'react';
import { useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { Loading, Header, LaunchDetail } from '../components';
import { ActionButton } from '../containers';

export const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {
      id
      site
      isBooked
      rocket {
        id
        name
        type
      }
      mission {
        name
        missionPatch
      }
    }
  }
`;
```

像之前一样我们来完善Launch函数，粘贴下列代码
***src/pages/launch.js***

```javascript
export default function Launch({ launchId }) {
  const { data, loading, error } = useQuery(
    GET_LAUNCH_DETAILS,
    { variables: { launchId } }
  );
  if (loading) return <Loading />;
  if (error) return <p>ERROR: {error.message}</p>;

  return (
    <Fragment>
      <Header image={data.launch.mission.missionPatch}>
        {data.launch.mission.name}
      </Header>
      <LaunchDetail {...data.launch} />
      <ActionButton {...data.launch} />
    </Fragment>
  );
}
```

### 使用片段共享代码

我们可以使用一个**fragment**来共享两个字段
要了解如何构建片段，请导航至`src/pages/launches.js`并将以下代码复制到文件中：

`src/pages/launches.js`

```javascript
export const LAUNCH_TILE_DATA = gql`
  fragment LaunchTile on Launch {
    id
    isBooked
    rocket {
      id
      name
    }
    mission {
      name
      missionPatch
    }
  }
`;
```
接下来，来让我们看看如何引用这个片段

`src/pages/launches.js`

```javascript
const GET_LAUNCHES = gql`
  query launchList($after: String) {
    launches(after: $after) {
      cursor
      hasMore

      launches {
        ...LaunchTile
      }
    }

  }
  ${LAUNCH_TILE_DATA}
`;
```

然后我们在src/pages/launch.js也引用这个片段代码

```javascript
import { LAUNCH_TILE_DATA } from './launches';

export const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {
      site
      rocket {
        type
      }
      ...LaunchTile
    }
  }

${LAUNCH_TILE_DATA}`;
```

看看吧，我们的代码的写法发生了一些变化，我们的代码变得更简洁了。

### 自定义提取策略

有时候我们会有一些数据经常刷新，那么我们可以告诉Apollo Client要绕过缓存
我们可以通过自定义`useQuery`挂钩的`fetchPolicy`来做到这一点。

首先，让我们导航到`src/pages/profile.js`并编写我们的查询：

***src/pages/profile.js***
```javascript
import React, { Fragment } from 'react';
import { useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { Loading, Header, LaunchTile } from '../components';
import { LAUNCH_TILE_DATA } from './launches';

const GET_MY_TRIPS = gql`
  query GetMyTrips {
    me {
      id
      email
      trips {
        ...LaunchTile
      }
    }
  }
  ${LAUNCH_TILE_DATA}
`;
```

Apollo Client获取数据策略是`cache-first`,让我们改成network-only试试，这样就会实时刷新获取后端数据

***src/pages/profile.js***

```javascript
export default function Profile() {
  const { data, loading, error } = useQuery(
    GET_MY_TRIPS,

    { fetchPolicy: "network-only" }
  );

  if (loading) return <Loading />;
  if (error) return <p>ERROR: {error.message}</p>;

  return (
    <Fragment>
      <Header>My Trips</Header>
      {data.me && data.me.trips.length ? (
        data.me.trips.map(launch => (
          <LaunchTile key={launch.id} launch={launch} />
        ))
      ) : (
        <p>You haven't booked any trips</p>
      )}
    </Fragment>
  );
}
```
如果尝试渲染此查询，你将注意到它返回null。这是因为我们需要首先实现登录特性。我们将在下一节处理登录。

- [上一页](./connect_client_api.md)   [下一页](./update_data_with_mutations.md)
