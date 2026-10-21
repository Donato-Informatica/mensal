import { Avatar, Menu, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconKey,
  IconLock,
  IconLogout,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { AccessTokensModal } from "./access-tokens.tsx";
import classes from "./account-menu.module.css";
import { ChangePasswordModal } from "./change-password.tsx";
import { useSession } from "./session.ts";
import { SettingsModal } from "./settings.tsx";
import { SignOutModal } from "./sign-out-button.tsx";

/**
 * The header's account menu: an avatar with the user icon, which opens their name and
 * email over Configurações, Alterar senha and Sair. Each item opens its modal.
 */
export function AccountMenu() {
  const { name, email } = useSession().user;
  const [settings, settingsHandlers] = useDisclosure(false);
  const [password, passwordHandlers] = useDisclosure(false);
  const [tokens, tokensHandlers] = useDisclosure(false);
  const [signOut, signOutHandlers] = useDisclosure(false);

  return (
    <>
      <Menu position="bottom-end" width={260} hideDetached={false}>
        <Menu.Target>
          <UnstyledButton
            className={classes.trigger}
            aria-label="Conta"
            title="Conta"
          >
            <Avatar
              variant="surface"
              className={classes.avatar}
              aria-hidden="true"
            >
              <IconUser size={18} aria-hidden="true" />
            </Avatar>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <div className={classes.identity}>
            {name && (
              <Text fw={500} truncate title={name}>
                {name}
              </Text>
            )}
            <Text c="dimmed" fz="sm" truncate title={email}>
              {email}
            </Text>
          </div>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconSettings size={18} aria-hidden="true" />}
            onClick={settingsHandlers.open}
          >
            Configurações
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLock size={18} aria-hidden="true" />}
            onClick={passwordHandlers.open}
          >
            Alterar senha
          </Menu.Item>
          <Menu.Item
            leftSection={<IconKey size={18} aria-hidden="true" />}
            onClick={tokensHandlers.open}
          >
            Tokens de acesso
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconLogout size={18} aria-hidden="true" />}
            onClick={signOutHandlers.open}
          >
            Sair
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <SettingsModal opened={settings} onClose={settingsHandlers.close} />
      <ChangePasswordModal opened={password} onClose={passwordHandlers.close} />
      <AccessTokensModal opened={tokens} onClose={tokensHandlers.close} />
      <SignOutModal opened={signOut} onClose={signOutHandlers.close} />
    </>
  );
}
