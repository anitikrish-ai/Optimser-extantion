import { defineConfig } from 'wxt';

// Universal Website Performance Optimizer - WXT Configuration
export default defineConfig({
  manifest: {
    name: 'Universal Website Performance Optimizer',
    description: 'Intelligently reduces website CPU, memory, network, and rendering overhead on low-end devices.',
    version: '1.0.0',
    permissions: [
      'storage',
      'declarativeNetRequest',
      'activeTab'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'default_performance_rules',
          enabled: true,
          path: 'rules/default-rules.json'
        }
      ]
    },
    action: {
      default_title: 'Universal Performance Optimizer',
      default_popup: 'entrypoints/popup/index.html',
      default_icon: 'assets/icons/icon.svg'
    },
    options_ui: {
      page: 'entrypoints/options/index.html',
      open_in_tab: true
    },
    icons: {
      '16': 'assets/icons/icon.svg',
      '32': 'assets/icons/icon.svg',
      '48': 'assets/icons/icon.svg',
      '128': 'assets/icons/icon.svg'
    }
  }
});
