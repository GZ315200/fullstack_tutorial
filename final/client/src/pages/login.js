import React from 'react';
import { useApolloClient, useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';

import { LoginForm, Loading } from '../components';

export const LOGIN_USER = gql`
  mutation login($email: String!) {
    login(email: $email) {
      success,
      message,
      token,
    }
  }
`;

export default function Login() {
  const client = useApolloClient();
  const [login, { loading, error }] = useMutation(
    LOGIN_USER,
    {
      onCompleted({ login }) {
        const { success, message } = login
        if (success) {
          localStorage.setItem('token', login.token);
          client.writeData({ data: { isLoggedIn: true } });
        } else {
          alert(message)
        }
      }
    }
  );

  if (loading) return <Loading />;
  if (error) return <p>An error occurred</p>;

  return <LoginForm login={login} />;
}
