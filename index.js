require('dotenv').config();
const core = require('oci-core');
const axios = require('axios');
const common = require('oci-common');
const _ = require('lodash');

const configurationFilePath = process.env.OCI_CONFIG_FILE || '~/.oci/config';
const configProfile = process.env.OCI_CONFIG_PROFILE || 'DEFAULT';
const provider = new common.ConfigFileAuthenticationDetailsProvider(configurationFilePath, configProfile);
const networkSecurityGroupId = process.env.NETWORK_SECURITY_GROUP_ID;

const execute = async () => {
  console.time('Updating Cloudflare IPs');
  try {
    // get CF ip cidr blocks
    const baseUrl = process.env.CF_API_ENDPOINT || 'https://api.cloudflare.com/client/v4';
    const response = await axios.get(`${baseUrl}/ips`);
    const { ipv4_cidrs, ipv6_cidrs } = response.data.result;
    const cidrs = [...ipv4_cidrs, ...ipv6_cidrs];

    // Get current cidr list
    const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    // Create a request and dependent object(s).
    const listNetworkSecurityGroupSecurityRulesRequest = {
      networkSecurityGroupId: networkSecurityGroupId,
      direction: core.requests.ListNetworkSecurityGroupSecurityRulesRequest.Direction.Ingress,
    };
    // Send request to the Client.
    const listNetworkSecurityGroupSecurityRulesResponse = await client.listNetworkSecurityGroupSecurityRules(
      listNetworkSecurityGroupSecurityRulesRequest
    );
    const currentCidrsHttp = listNetworkSecurityGroupSecurityRulesResponse.items
      .filter((item) => {
        return item.sourceType === 'CIDR_BLOCK' && item.tcpOptions.destinationPortRange.max === 80;
      })
      .map((item) => {
        return {
          id: item.id,
          source: item.source,
        };
      });
    const currentCidrsHttps = listNetworkSecurityGroupSecurityRulesResponse.items
      .filter((item) => {
        return item.sourceType === 'CIDR_BLOCK' && item.tcpOptions.destinationPortRange.max === 443;
      })
      .map((item) => {
        return {
          id: item.id,
          source: item.source,
        };
      });

    // add missing
    const addingCidrs = [];
    cidrs.forEach(async (cidr) => {
      _.find(currentCidrsHttp, { source: cidr }) || addingCidrs.push({ port: 80, cidr: cidr });
      _.find(currentCidrsHttps, { source: cidr }) || addingCidrs.push({ port: 443, cidr: cidr });
    });
    if (addingCidrs.length > 0) {
      const chunks = _.chunk(addingCidrs, 25);
      for (const chunk of chunks) {
        await add(provider, chunk);
      }
    }

    // remove unused
    const removingIds = [];
    currentCidrsHttp.forEach(async (currentCidr) => {
      if (!cidrs.includes(currentCidr.source)) {
        removingIds.push(currentCidr.id);
      }
    });
    currentCidrsHttps.forEach(async (currentCidr) => {
      if (!cidrs.includes(currentCidr.source)) {
        removingIds.push(currentCidr.id);
      }
    });
    if (removingIds.length) {
      await remove(provider, removingIds);
    }
  } catch (error) {
    console.log('Failed with error  ' + error);
  }
  console.timeEnd('Updating Cloudflare IPs');
};

const add = async (provider, cidrs) => {
  // Create a service client
  const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });

  // Create a request and dependent object(s).
  const addNetworkSecurityGroupSecurityRulesDetails = {
    securityRules: cidrs.map((cidr) => {
      return {
        destinationType: core.models.AddSecurityRuleDetails.DestinationType.CidrBlock,
        direction: core.models.AddSecurityRuleDetails.Direction.Ingress,
        protocol: '6',
        source: cidr.cidr,
        sourceType: core.models.AddSecurityRuleDetails.SourceType.CidrBlock,
        tcpOptions: {
          destinationPortRange: {
            max: cidr.port,
            min: cidr.port,
          },
        },
      };
    }),
  };

  const addNetworkSecurityGroupSecurityRulesRequest = {
    networkSecurityGroupId: networkSecurityGroupId,
    addNetworkSecurityGroupSecurityRulesDetails: addNetworkSecurityGroupSecurityRulesDetails,
  };

  // Send request to the Client.
  const addNetworkSecurityGroupSecurityRulesResponse = await client.addNetworkSecurityGroupSecurityRules(
    addNetworkSecurityGroupSecurityRulesRequest
  );

  console.log(addNetworkSecurityGroupSecurityRulesResponse.addedNetworkSecurityGroupSecurityRules.securityRules);
};

const remove = async (provider, ids) => {
  // Create a service client
  const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });

  // Create a request and dependent object(s).
  const removeNetworkSecurityGroupSecurityRulesDetails = {
    securityRuleIds: ids,
  };

  const removeNetworkSecurityGroupSecurityRulesRequest = {
    networkSecurityGroupId: networkSecurityGroupId,
    removeNetworkSecurityGroupSecurityRulesDetails: removeNetworkSecurityGroupSecurityRulesDetails,
  };

  // Send request to the Client.
  const removeNetworkSecurityGroupSecurityRulesResponse = await client.removeNetworkSecurityGroupSecurityRules(
    removeNetworkSecurityGroupSecurityRulesRequest
  );

  console.log(removeNetworkSecurityGroupSecurityRulesResponse);
};

(async () => {
  console.log(`Starting ${process.env.npm_package_name} v${process.env.npm_package_version}`);
  await execute();
  process.exit();
})();
