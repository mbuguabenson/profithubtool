import { action, makeObservable, observable } from 'mobx';
import RootStore from './root-store';

export interface IDollarflipperStore {
  target_profit: number;
  stake_percentage: number;
  challenge_days: number;
  sessions_per_day: number; // 1-4 or 24
  completed_sessions: number;
  is_running: boolean;
  
  setTargetProfit: (val: number) => void;
  setStakePercentage: (val: number) => void;
  setChallengeDays: (val: number) => void;
  setSessionsPerDay: (val: number) => void;
  startDollarflipper: () => void;
  stopDollarflipper: () => void;
  markSessionCompleted: () => void;
}

export default class DollarflipperStore implements IDollarflipperStore {
  root_store: RootStore;
  
  target_profit = 10;
  stake_percentage = 2; // 2% by default
  challenge_days = 30;
  sessions_per_day = 1; // Default 1 session
  completed_sessions = 0;
  is_running = false;

  constructor(root_store: RootStore) {
    makeObservable(this, {
      target_profit: observable,
      stake_percentage: observable,
      challenge_days: observable,
      sessions_per_day: observable,
      completed_sessions: observable,
      is_running: observable,
      
      setTargetProfit: action,
      setStakePercentage: action,
      setChallengeDays: action,
      setSessionsPerDay: action,
      startDollarflipper: action,
      stopDollarflipper: action,
      markSessionCompleted: action,
    });

    this.root_store = root_store;
    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('dollarflipper_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.target_profit = parsed.target_profit || 10;
        this.stake_percentage = parsed.stake_percentage || 2;
        this.challenge_days = parsed.challenge_days || 30;
        this.sessions_per_day = parsed.sessions_per_day || 1;
        this.completed_sessions = parsed.completed_sessions || 0;
      }
    } catch (e) {
      console.error('Failed to load dollarflipper state', e);
    }
  }

  saveState() {
    localStorage.setItem('dollarflipper_state', JSON.stringify({
      target_profit: this.target_profit,
      stake_percentage: this.stake_percentage,
      challenge_days: this.challenge_days,
      sessions_per_day: this.sessions_per_day,
      completed_sessions: this.completed_sessions,
    }));
  }

  setTargetProfit = (val: number) => {
    this.target_profit = val;
    this.saveState();
  };

  setStakePercentage = (val: number) => {
    this.stake_percentage = val;
    this.saveState();
  };

  setChallengeDays = (val: number) => {
    this.challenge_days = val;
    this.saveState();
  };

  setSessionsPerDay = (val: number) => {
    this.sessions_per_day = val;
    this.saveState();
  };

  startDollarflipper = () => {
    this.is_running = true;
    
    // Calculate Stake based on account balance
    const balance = this.root_store.client.balance || 0;
    const stake = balance * (this.stake_percentage / 100);
    
    // Set scanner params to strictly Over/Under
    this.root_store.scanner.stake = stake > 0.35 ? stake : 0.35; // enforce min stake
    this.root_store.scanner.take_profit = this.target_profit;
    this.root_store.scanner.selected_trade_type = 'over_under';
    this.root_store.scanner.selected_strategies = ['over_under'];
    
    // Toggle full ai automation ON
    this.root_store.scanner.setFullAiAutomation(true);

    // Automatically trigger scanner if it's not scanning
    if (!this.root_store.scanner.is_scanning) {
      this.root_store.scanner.startScanning();
    }
  };

  stopDollarflipper = () => {
    this.is_running = false;
    this.root_store.scanner.setFullAiAutomation(false);
    this.root_store.scanner.stopScanning();
  };

  markSessionCompleted = () => {
    this.completed_sessions += 1;
    this.saveState();
    
    const total_sessions = this.challenge_days * this.sessions_per_day;
    if (this.completed_sessions >= total_sessions) {
      this.is_running = false;
      this.root_store.scanner.setFullAiAutomation(false);
      // Optional: Reset challenge or show success!
    }
  };
}
