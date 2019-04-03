const jwt = require('jsonwebtoken');

function checkToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.SECRET, (err, decoded) => {
            resolve(decoded)
        });
    })
}
  
async function verifyRole(token, role, callback, rootValue) {
    const user = await checkToken(token);
    if (get(user, 'role') === role) {
        return callback();
    } else {
        console.log('Unauthorized');
        return rootValue ? { rootValue: null } : null
    }
}

module.exports = {
    checkToken,
    verifyRole,
}