import { confirmAction } from '../../ui/confirm';
import { useState } from 'react';
import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUserStatus,
  type UserSession,
} from '../../editor/api';
import { getConfirmationMessage } from '../../editor/confirmations';
import { getUserPrimaryIdentity } from '../../editor/identity';

type UseAdminUserManagementOptions = {
  refreshAll: () => Promise<void>;
  setMessage: (message: string | null) => void;
};

type UserActionKind = 'create' | 'toggle' | 'delete' | null;

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function useAdminUserManagement({ refreshAll, setMessage }: UseAdminUserManagementOptions) {
  const [createUsername, setCreateUsername] = useState('');
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserRole, setCreateUserRole] = useState<UserSession['role']>('user');
  const [userActionBusy, setUserActionBusy] = useState(false);
  const [userActionTargetId, setUserActionTargetId] = useState<string | null>(null);
  const [userActionKind, setUserActionKind] = useState<UserActionKind>(null);

  async function handleToggleUser(user: UserSession) {
    if (user.status === 'active') {
      const confirmed = await confirmAction({
        title: 'Disable this account?',
        body: 'The user will be signed out and cannot sign in again until an administrator activates the account.',
        confirmLabel: 'Disable account',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    setUserActionBusy(true);
    setUserActionTargetId(user.id);
    setUserActionKind('toggle');
    setMessage(null);

    try {
      await updateAdminUserStatus(user.id, user.status === 'active' ? 'disabled' : 'active');
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      setUserActionBusy(false);
      setUserActionTargetId(null);
      setUserActionKind(null);
    }
  }

  async function handleDeleteUser(user: UserSession) {
    const confirmed = await confirmAction({
      title: 'Delete this account?',
      body: getConfirmationMessage('deleteUser', { userLabel: getUserPrimaryIdentity(user) }),
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setUserActionBusy(true);
    setUserActionTargetId(user.id);
    setUserActionKind('delete');
    setMessage(null);

    try {
      const payload = await deleteAdminUser(user.id);
      await refreshAll();
      const { deletedProjectCount, deletedTemplateCount, deletedUploadCount, retainedUploadCount } = payload.summary;
      setMessage(
        `User deleted. Removed ${formatCountLabel(deletedProjectCount, 'project')}, ${formatCountLabel(deletedTemplateCount, 'template')}, and ${formatCountLabel(deletedUploadCount, 'upload')}${retainedUploadCount ? `. ${formatCountLabel(retainedUploadCount, 'upload')} ${retainedUploadCount === 1 ? 'was' : 'were'} retained because other projects still reference ${retainedUploadCount === 1 ? 'it' : 'them'}.` : '.'}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete user.');
    } finally {
      setUserActionBusy(false);
      setUserActionTargetId(null);
      setUserActionKind(null);
    }
  }

  async function handleCreateUser() {
    if (!createUsername.trim() || !createUserEmail.trim() || !createUserPassword.trim()) {
      setMessage('Username, email, and temporary password are required.');
      return;
    }

    setUserActionBusy(true);
    setUserActionTargetId(null);
    setUserActionKind('create');
    setMessage(null);

    try {
      await createAdminUser({
        username: createUsername,
        email: createUserEmail,
        password: createUserPassword,
        role: createUserRole,
      });
      setCreateUsername('');
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserRole('user');
      await refreshAll();
      setMessage('User created and activated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create user.');
    } finally {
      setUserActionBusy(false);
      setUserActionTargetId(null);
      setUserActionKind(null);
    }
  }

  return {
    createUserEmail,
    createUserPassword,
    createUserRole,
    createUsername,
    handleCreateUser,
    handleDeleteUser,
    handleToggleUser,
    setCreateUserEmail,
    setCreateUserPassword,
    setCreateUserRole,
    setCreateUsername,
    userActionBusy,
    userActionKind,
    userActionTargetId,
  };
}
