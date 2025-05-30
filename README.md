# Import apps from Entra to Enterprice Browser

Since it requires additional scopes to access applications and custom attributes, this app can't be a part of the existing Admin and needs to perform auth with Entra separately.

TO run this app in Enterprise Browser

1. host this app
    1. npm i
    2. npm run build
    3. http-server . -p 3002 -c-1
2. configure backend
    1. set Entra as auth provider
    2. add a row in service_gateway->service table

            name: build
            origin: http://localhost:3002

3. create an app, via Admin app, with http://localhost/build as URI

