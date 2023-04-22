import Logger from './lib/logger';
import CommandHandler from './cmd/listener';
import AkamaiManager from './modules/bedBathBeyond/akamai/akamaiManager';
import SettingsManager from './framework/settings/settingsManager';
import TaskManager from '@Framework/tasks/taskManager';
import Auth from './auth/auth';
import './services/client';
import Blacklister from './auth/appBlacklist';
import ImapManager from '@Modules/bedBathBeyond/imap/imap';

export const settingsManager = new SettingsManager();

export const auth = new Auth();
//export const appBlacklist = new Blacklister();

export const logger = new Logger();
export const cli = new CommandHandler();
export const cookieManager = new AkamaiManager();
export const taskManager = new TaskManager();
export const imapManager = new ImapManager();
export default class Master {}
