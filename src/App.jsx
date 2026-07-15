import React, { useState, useEffect, useCallback } from 'react';
import { autoConnect } from '@unicitylabs/sphere-sdk/connect/browser';
import { 
  Coins, 
  Wallet, 
  PlusCircle, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Compass, 
  Info, 
  RefreshCw, 
  LogOut, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  User
} from 'lucide-react';

export default function App() {
  // --- WALLET STATE ---
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pubkey, setPubkey] = useState('');
  const [nametag, setNametag] = useState('');
  const [networkName, setNetworkName] = useState('testnet2');
  const [balances, setBalances] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [disconnectFn, setDisconnectFn] = useState(null);

  // --- TOKEN LAUNCHER STATE ---
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [totalSupply, setTotalSupply] = useState('1000000');
  const [decimals, setDecimals] = useState(9);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [minting, setMinting] = useState(false);
  
  // --- SUCCESS STATE ---
  const [mintSuccess, setMintSuccess] = useState(null);
  const [copiedId, setCopiedId] = useState('');

  // --- PERSISTED CUSTOM TOKENS ---
  const [customTokens, setCustomTokens] = useState([]);

  // Fetch custom tokens from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sphere_custom_tokens');
      if (stored) {
        setCustomTokens(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load custom tokens from localStorage:', e);
    }
  }, []);

  // Format token balance to human-readable form
  const formatTokenBalance = useCallback((amountStr, tokenDecimals) => {
    if (!amountStr || amountStr === '0') return '0.00';
    const dec = Number(tokenDecimals) ?? 0;
    if (dec === 0) return amountStr;
    
    try {
      const amount = BigInt(amountStr);
      const divisor = 10n ** BigInt(dec);
      const whole = amount / divisor;
      const fraction = amount % divisor;
      
      let fracStr = fraction.toString().padStart(dec, '0');
      if (fracStr.length > 6) {
        fracStr = fracStr.slice(0, 6);
      }
      fracStr = fracStr.replace(/0+$/, '');
      if (!fracStr) return whole.toString();
      return `${whole}.${fracStr}`;
    } catch (e) {
      return amountStr;
    }
  }, []);

  // Fetch current wallet balance
  const fetchBalance = useCallback(async (activeClient) => {
    if (!activeClient) return;
    setLoadingBalance(true);
    try {
      // Query the wallet balance via Connect client
      const rawAssets = await activeClient.query('sphere_getBalance');
      setBalances(rawAssets || []);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // Enrich assets with locally registered custom tokens metadata
  const getEnrichedBalances = useCallback(() => {
    return balances.map(asset => {
      const match = customTokens.find(t => t.id.toLowerCase() === asset.coinId.toLowerCase());
      if (match) {
        return {
          ...asset,
          name: match.name,
          symbol: match.symbol,
          decimals: match.decimals,
          iconUrl: match.imageUrl || asset.iconUrl
        };
      }
      return asset;
    });
  }, [balances, customTokens]);

  // Handle auto-connecting to previously approved session on mount
  useEffect(() => {
    const tryAutoConnect = async () => {
      try {
        const res = await autoConnect({
          dapp: {
            name: 'Sphere Token Launcher',
            description: 'Create and self-mint custom fungible tokens on Unicity Testnet v2.',
            url: window.location.origin
          },
          walletUrl: 'https://sphere.unicity.network',
          network: { id: 4, name: 'testnet2' },
          silent: true // Do not open popup if not already approved
        });

        setClient(res.client);
        setIsConnected(true);
        setPubkey(res.connection.identity.chainPubkey);
        setNametag(res.connection.identity.nametag || '');
        setNetworkName(res.connection.walletNetwork?.name || 'testnet2');
        
        fetchBalance(res.client);

        // Listen for identity changes
        const unsubIdentity = res.client.on('identity:changed', (data) => {
          if (data && data.identity) {
            setPubkey(data.identity.chainPubkey);
            setNametag(data.identity.nametag || '');
          }
          fetchBalance(res.client);
        });

        setDisconnectFn(() => async () => {
          unsubIdentity();
          await res.disconnect();
          setIsConnected(false);
          setClient(null);
          setBalances([]);
        });
      } catch (err) {
        console.log('No active approved session found for auto-connect.');
      }
    };

    tryAutoConnect();
  }, [fetchBalance]);

  // Connect wallet button trigger
  const connectWallet = async () => {
    setConnecting(true);
    setGlobalError('');
    try {
      const res = await autoConnect({
        dapp: {
          name: 'Sphere Token Launcher',
          description: 'Create and self-mint custom fungible tokens on Unicity Testnet v2.',
          url: window.location.origin
        },
        walletUrl: 'https://sphere.unicity.network',
        network: { id: 4, name: 'testnet2' }
      });

      setClient(res.client);
      setIsConnected(true);
      setPubkey(res.connection.identity.chainPubkey);
      setNametag(res.connection.identity.nametag || '');
      setNetworkName(res.connection.walletNetwork?.name || 'testnet2');

      fetchBalance(res.client);

      const unsubIdentity = res.client.on('identity:changed', (data) => {
        if (data && data.identity) {
          setPubkey(data.identity.chainPubkey);
          setNametag(data.identity.nametag || '');
        }
        fetchBalance(res.client);
      });

      setDisconnectFn(() => async () => {
        unsubIdentity();
        await res.disconnect();
        setIsConnected(false);
        setClient(null);
        setBalances([]);
      });
    } catch (err) {
      console.error('Connection failed:', err);
      setGlobalError(err instanceof Error ? err.message : 'Failed to connect to Sphere wallet');
    } finally {
      setConnecting(false);
    }
  };

  // Generate cryptographically secure random 32-byte hex for coinId
  const generateCoinId = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Trigger Token Launch & Self-Mint
  const handleLaunchToken = async (e) => {
    e.preventDefault();
    if (!isConnected || !client) {
      setGlobalError('Please connect your Sphere wallet first');
      return;
    }
    if (!tokenName || !tokenSymbol || !totalSupply || decimals === '') {
      setGlobalError('Please fill in all required token properties');
      return;
    }

    setMinting(true);
    setGlobalError('');
    setMintSuccess(null);

    try {
      const coinId = generateCoinId();
      const rawAmount = BigInt(totalSupply) * (10n ** BigInt(decimals));

      // Request the Wallet to self-mint the token via Connect intent
      const result = await client.intent('mint', {
        coinId: coinId,
        amount: rawAmount.toString()
      });
      const tokenId = result?.tokenId || result?.token?.id || 'Unknown';

      // Save token metadata definition locally
      const newToken = {
        id: coinId,
        name: tokenName,
        symbol: tokenSymbol.toUpperCase(),
        decimals: Number(decimals),
        description: description,
        imageUrl: imageUrl,
        mintedAt: Date.now()
      };

      const updatedCustom = [...customTokens, newToken];
      setCustomTokens(updatedCustom);
      localStorage.setItem('sphere_custom_tokens', JSON.stringify(updatedCustom));

      // Update success states
      setMintSuccess({
        coinId,
        tokenId,
        name: tokenName,
        symbol: tokenSymbol.toUpperCase(),
        amount: totalSupply,
        decimals
      });

      // Clear form inputs
      setTokenName('');
      setTokenSymbol('');
      setDescription('');
      setImageUrl('');

      // Refresh balances
      fetchBalance(client);
    } catch (err) {
      console.error('Token launch failed:', err);
      setGlobalError(err instanceof Error ? err.message : 'Token minting intent rejected or failed');
    } finally {
      setMinting(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedId(type);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    if (disconnectFn) {
      await disconnectFn();
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      {/* --- HEADER --- */}
      <header className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/30 text-teal-400">
            <Coins className="w-6 h-6 animate-float" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
              Sphere Token Launcher
            </h1>
            <p className="text-xs text-slate-400 font-medium">Unicity Testnet v2</p>
          </div>
        </div>

        {/* Network & Wallet connection status */}
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Compass className="text-teal-400 w-3.5 h-3.5" />
              <span>{networkName}</span>
            </div>
          )}
          
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-sm font-medium transition-all duration-200"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          ) : (
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-950 font-semibold text-sm shadow-lg shadow-teal-500/10 hover:shadow-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Wallet className="w-4 h-4" />
              <span>{connecting ? 'Connecting...' : 'Connect Sphere'}</span>
            </button>
          )}
        </div>
      </header>

      {/* --- MAIN BODY --- */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-8 flex-1 items-start">
        
        {/* LEFT COLUMN: Launcher Form / Success State */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Global error alerts */}
          {globalError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-pulse-slow">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{globalError}</p>
            </div>
          )}

          {/* SUCCESS MODAL CARD */}
          {mintSuccess ? (
            <div className="glass-panel-glow rounded-3xl p-6 md:p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3 text-teal-400">
                <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-bold font-heading text-slate-100">Token Minted Successfully!</h3>
                  <p className="text-xs text-teal-500 font-semibold uppercase tracking-wider">Transaction Settled</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-teal-950/20 border border-teal-500/10 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Supply Minted</p>
                  <p className="text-2xl font-bold font-heading text-slate-100">
                    {Number(mintSuccess.amount).toLocaleString()} <span className="text-teal-400">{mintSuccess.symbol}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Decimals</p>
                  <p className="text-lg font-bold font-heading text-slate-200">{mintSuccess.decimals}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs text-slate-400">
                    <span>COIN ID (METADATA REFERENCE)</span>
                    <button 
                      onClick={() => copyToClipboard(mintSuccess.coinId, 'coinId')}
                      className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === 'coinId' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code className="block w-full overflow-x-auto p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 select-all font-mono break-all leading-relaxed">
                    {mintSuccess.coinId}
                  </code>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 text-xs text-slate-400">
                    <span>NEW TOKEN ID (BEARER STATE HASH)</span>
                    <button 
                      onClick={() => copyToClipboard(mintSuccess.tokenId, 'tokenId')}
                      className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === 'tokenId' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code className="block w-full overflow-x-auto p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 select-all font-mono break-all leading-relaxed">
                    {mintSuccess.tokenId}
                  </code>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setMintSuccess(null)}
                  className="flex-1 px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 text-sm font-semibold transition-all duration-200"
                >
                  Create Another Token
                </button>
                <a
                  href="https://developers.unicity.network/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/20 text-teal-400 text-sm font-semibold transition-all duration-200"
                >
                  <span>Read Developer Docs</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : (
            /* LAUNCHER FORM */
            <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10"></div>
              
              <div>
                <h3 className="text-xl font-bold font-heading text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <span>Launch Custom Fungible Token</span>
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Define your token parameters and self-mint them immediately to your connected wallet.
                </p>
              </div>

              <form onSubmit={handleLaunchToken} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Token Name *</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g. My Custom Coin"
                      className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Symbol *</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      placeholder="e.g. MCC"
                      maxLength={10}
                      className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm uppercase"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Supply *</label>
                    <input
                      type="number"
                      value={totalSupply}
                      onChange={(e) => setTotalSupply(e.target.value)}
                      placeholder="e.g. 1000000"
                      min="1"
                      className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Decimals *</label>
                    <input
                      type="number"
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 9"
                      min="0"
                      max="18"
                      className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter details about your custom token..."
                    className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm h-20 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Image / Icon URL (Optional)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="e.g. https://example.com/logo.png"
                    className="glass-input px-4 py-3 rounded-xl text-slate-100 text-sm"
                  />
                </div>

                <div className="mt-2">
                  <button
                    type="submit"
                    disabled={minting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-500 hover:from-teal-400 hover:to-indigo-400 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/5 hover:shadow-teal-400/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    {minting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating & Minting Token...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>Create & Mint Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs mt-2">
                <Info className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Developer Note:</strong> Upon form submission, the dApp uses a secure PRNG to generate a deterministic 64-character hex coin ID. It registers the metadata in the local dApp context, and triggers the wallet's self-mint intent via the Sphere Connect Protocol.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Connected ID & Balances List */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Identity & Status card */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unicity Identity</h4>
            
            {isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-500/10 border-teal-500/30 text-teal-400 rounded-xl border">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-100 font-bold font-heading text-lg">
                        {nametag || 'Anonymous Agent'}
                      </p>
                      <span className="px-2 py-0.5 rounded text-[10px] border font-bold uppercase tracking-wider bg-teal-900/30 text-teal-400 border-teal-500/20">
                        Unicity ID
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Active P2P Identity</p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">CHAIN PUBLIC KEY</span>
                    <button 
                      onClick={() => copyToClipboard(pubkey, 'pubkey')}
                      className="font-semibold flex items-center gap-1 text-teal-400 hover:text-teal-300"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedId === 'pubkey' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code className="text-[10px] font-mono p-2.5 bg-slate-950 rounded-lg text-slate-400 border border-slate-850 break-all select-all leading-normal">
                    {pubkey}
                  </code>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <Wallet className="w-10 h-10 text-slate-600 mx-auto mb-2.5 animate-pulse-slow" />
                <p className="text-sm font-semibold text-slate-400">Wallet Disconnected</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Connect your Unicity Sphere wallet to launch custom tokens.
                </p>
              </div>
            )}
          </div>

          {/* Balances List */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wallet Balance</h4>
              {isConnected && (
                <button
                  onClick={() => fetchBalance(client)}
                  disabled={loadingBalance}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 transition-all duration-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBalance ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {isConnected ? (
              <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                {getEnrichedBalances().length > 0 ? (
                  getEnrichedBalances().map((asset, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 hover:border-slate-800 flex items-center justify-between transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/10 to-teal-500/10 border border-slate-700/60 flex items-center justify-center text-teal-400 font-extrabold text-sm uppercase shadow-sm">
                          {asset.iconUrl ? (
                            <img src={asset.iconUrl} alt={asset.symbol} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <span>{asset.symbol ? asset.symbol.slice(0, 3) : 'TOK'}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-200 leading-tight">
                            {asset.name || 'Unknown Asset'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-500 tracking-wider">
                              {asset.coinId.slice(0, 10)}...{asset.coinId.slice(-8)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(asset.coinId, `coin-${idx}`)}
                              className="text-[10px] text-teal-500 hover:text-teal-400 font-semibold"
                            >
                              {copiedId === `coin-${idx}` ? 'Copied' : 'Copy ID'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-100 leading-none">
                          {formatTokenBalance(asset.totalAmount, asset.decimals)}
                        </p>
                        <p className="text-[10px] text-teal-400/80 font-bold uppercase tracking-wider mt-1.5 leading-none">
                          {asset.symbol || 'TOK'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                    <p className="font-medium">No assets found in wallet.</p>
                    <p className="text-slate-600 mt-0.5">Your balances will show up here after minting.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                Connect your wallet to display token balances.
              </div>
            )}
          </div>
        </div>

      </main>

      {/* --- FOOTER --- */}
      <footer className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-800 text-slate-500 text-xs gap-4">
        <p className="font-medium">
          Built on Unicity Network Testnet v2 using @unicitylabs/sphere-sdk v{client?.sdkVersion || '0.11.12'}
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/unicity-sphere"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-slate-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>GitHub</span>
          </a>
          <span className="text-slate-800">•</span>
          <a
            href="https://developers.unicity.network/docs"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-400 transition-colors"
          >
            Developer Portal
          </a>
        </div>
      </footer>
    </div>
  );
}
