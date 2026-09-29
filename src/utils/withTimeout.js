async function withTimeout(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error("Operation timed out")), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
module.exports = { withTimeout };
