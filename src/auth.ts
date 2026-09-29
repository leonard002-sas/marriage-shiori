import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js'

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
})

export function signIn(email: string, password: string) {
  return new Promise<string>((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool })
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: reject,
    })
  })
}

export function signUp(email: string, password: string) {
  return new Promise<void>((resolve, reject) => {
    pool.signUp(email, password, [], [], (error) => error ? reject(error) : resolve())
  })
}

export function confirmSignUp(email: string, code: string) {
  return new Promise<void>((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool })
    user.confirmRegistration(code, true, (error) => error ? reject(error) : resolve())
  })
}
