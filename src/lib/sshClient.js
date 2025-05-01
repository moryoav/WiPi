import SSHClient from '@dylankenneally/react-native-ssh-sftp';

/**
 * Run one shell command over SSH and return its stdout as a string.
 */
export async function runSSH({ host, username, password, command }) {
  // 1) open session
  const client = await SSHClient.connectWithPassword(
    host,            // host
    22,              // port
    username,
    password
  );

  try {
    // 2) run command
    const output = await client.execute(command);
    return output;   // plain-text result
  } finally {
    // 3) always close
    await client.disconnect();
  }
}
