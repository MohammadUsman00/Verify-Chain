/* MODULE: DB */
VC.db = {
  isBackendReady() {
    const { supabaseUrl, supabaseKey, edgeFunctionUrl } = VC.config;
    return Boolean(
      VC.supabase &&
      supabaseUrl &&
      supabaseKey &&
      edgeFunctionUrl &&
      /^https?:\/\//.test(supabaseUrl) &&
      /^https?:\/\//.test(edgeFunctionUrl)
    );
  },

  async signUp(email, password, sellerData) {
    if (!this.isBackendReady()) {
      throw new Error('Supabase is not configured. Use Demo login or add Supabase keys in VC.config.');
    }
    const { data: authData, error: authError } = await VC.supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const { data: seller, error: sellerError } = await VC.supabase
      .from('sellers')
      .insert({
        auth_id: authData.user.id,
        name: sellerData.name,
        business_name: sellerData.businessName,
        email,
        location: sellerData.location || 'Kashmir, India',
        plan: 'starter'
      })
      .select()
      .single();

    if (sellerError) throw sellerError;
    VC.state.seller = seller;
    VC.state.save();
    return seller;
  },

  async signIn(email, password) {
    if (!this.isBackendReady()) {
      throw new Error('Supabase is not configured. Use Demo login or add Supabase keys in VC.config.');
    }
    const { data, error } = await VC.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: seller } = await VC.supabase
      .from('sellers')
      .select('*')
      .eq('auth_id', data.user.id)
      .single();

    VC.state.seller = seller;
    VC.state.save();
    return seller;
  },

  async signOut() {
    if (this.isBackendReady()) {
      await VC.supabase.auth.signOut();
    }
    VC.state.seller = null;
    VC.state.batches = [];
    VC.state.scans = [];
    VC.state.save();
    VC.router.go('');
  },

  async restoreSession() {
    if (!this.isBackendReady()) return null;
    const { data: { session } } = await VC.supabase.auth.getSession();
    if (!session) return null;

    const { data: seller } = await VC.supabase
      .from('sellers')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (seller) {
      VC.state.seller = seller;
      VC.state.save();
    }
    return seller;
  },

  async createBatch(formData) {
    if (!VC.state.seller) throw new Error('Not authenticated');

    const batchId = VC.crypto.generateBatchId();
    const hmacSecret = await VC.crypto.generateSecret();
    const batch = {
      id: batchId,
      seller_id: VC.state.seller.id,
      product: formData.product,
      category: formData.category,
      origin: formData.origin,
      farm: formData.farm,
      harvest_date: formData.harvest,
      units: formData.units,
      cert_number: formData.cert || null,
      supply_chain: formData.supplyChain,
      hmac_secret: hmacSecret,
      status: 'active'
    };

    if (!this.isBackendReady()) {
      const tokens = await VC.crypto.generateBatchTokens({
        ...batch,
        units: formData.units
      });
      const localBatch = {
        ...batch,
        sellerName: VC.state.seller.business_name || VC.state.seller.name,
        harvest: formData.harvest,
        cert: formData.cert || null,
        supplyChain: formData.supplyChain,
        createdAt: Date.now()
      };
      VC.state.batches.unshift(localBatch);
      VC.state.save();
      return { batch: localBatch, tokens };
    }

    const { data, error } = await VC.supabase.from('batches').insert(batch).select().single();
    if (error) throw error;

    const tokens = await VC.crypto.generateBatchTokens({ ...data, hmac_secret: hmacSecret });
    const tokenRows = tokens.map((t) => ({ batch_id: batchId, unit_number: t.unit, token: t.token }));
    const { error: tokenError } = await VC.supabase.from('qr_tokens').insert(tokenRows);
    if (tokenError) throw tokenError;

    await VC.supabase.rpc('increment', {
      table_name: 'sellers',
      column_name: 'total_tags_issued',
      row_id: VC.state.seller.id,
      amount: formData.units
    });

    VC.state.batches.unshift({ ...data, tokens });
    VC.state.save();
    return { batch: data, tokens };
  },

  async getBatches() {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) {
      return VC.state.batches || [];
    }
    const { data, error } = await VC.supabase
      .from('batches')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    VC.state.batches = data || [];
    VC.state.save();
    return data || [];
  },

  async getBatchTokens(batchId) {
    if (!this.isBackendReady()) {
      const batch = VC.state.batches.find((b) => b.id === batchId);
      if (!batch) return [];
      const units = batch.units || 1;
      return Array.from({ length: units }, (_, idx) => ({
        unit_number: idx + 1,
        token: batchId
      }));
    }
    const { data, error } = await VC.supabase
      .from('qr_tokens')
      .select('*')
      .eq('batch_id', batchId)
      .order('unit_number', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getBatch(id) {
    const local = VC.state.batches.find((b) => b.id === id);
    if (local) return local;
    if (!this.isBackendReady()) return null;
    const { data } = await VC.supabase.from('batches').select('*').eq('id', id).single();
    return data || null;
  },

  async verifyQR(token) {
    if (!this.isBackendReady()) {
      let batchId = token;
      if (!String(token).startsWith('VC-')) {
        try {
          const padded = token.replace(/-/g, '+').replace(/_/g, '/');
          const decoded = JSON.parse(atob(padded));
          batchId = decoded.bid || token;
        } catch {
          batchId = token;
        }
      }
      const batch = VC.state.batches.find((b) => b.id === batchId);
      if (!batch) {
        return {
          verified: false,
          reason: 'NOT_FOUND',
          message: 'This product is not registered in demo mode.'
        };
      }

      const locationDisplay = 'Demo Location';
      const scanRow = {
        id: crypto.randomUUID(),
        batchId: batch.id,
        ts: Date.now(),
        location: locationDisplay,
        device: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        flagged: false
      };
      VC.state.scans.unshift(scanRow);
      VC.state.save();

      return {
        verified: true,
        batch: {
          id: batch.id,
          product: batch.product,
          category: batch.category,
          origin: batch.origin,
          farm: batch.farm,
          harvest_date: batch.harvest_date || batch.harvest || '-',
          cert_number: batch.cert_number || batch.cert || null,
          supply_chain: batch.supply_chain || batch.supplyChain || [],
          seller_name: batch.sellerName || VC.state.seller?.business_name || 'Verified Seller',
          seller_location: VC.state.seller?.location || 'Kashmir, India',
          seller_verified: true,
          created_at: batch.created_at || new Date().toISOString(),
          total_scans: VC.state.scans.filter((s) => s.batchId === batch.id).length
        },
        scan_history: VC.state.scans
          .filter((s) => s.batchId === batch.id)
          .slice(0, 10)
          .map((s) => ({
            location_display: s.location,
            scanned_at: new Date(s.ts).toISOString(),
            device_type: s.device,
            flagged: s.flagged
          })),
        current_scan: {
          location: locationDisplay,
          scanned_at: new Date().toISOString()
        }
      };
    }

    let lat = null;
    let lng = null;
    let city = null;
    let country = null;

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    if (!lat) {
      try {
        const geoRes = await fetch('https://ipapi.co/json/');
        const geo = await geoRes.json();
        lat = geo.latitude;
        lng = geo.longitude;
        city = geo.city;
        country = geo.country_name;
      } catch {}
    }

    const response = await fetch(VC.config.edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        lat, lng, city, country,
        device_type: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        user_agent: navigator.userAgent
      })
    });
    if (!response.ok) throw new Error('Verification service unavailable');
    return response.json();
  },

  async getScans(limit = 50) {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) {
      return VC.state.scans.slice(0, limit);
    }
    const { data, error } = await VC.supabase
      .from('scans')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    VC.state.scans = (data || []).map((s) => ({
      ...s,
      batchId: s.batch_id,
      ts: new Date(s.scanned_at).getTime(),
      location: s.location_display || 'Unknown',
      device: s.device_type || 'unknown'
    }));
    VC.state.save();
    return VC.state.scans;
  },

  async getFraudAlerts() {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) return [];
    const { data, error } = await VC.supabase
      .from('fraud_alerts')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  subscribeToScans(callback) {
    if (!this.isBackendReady()) return null;
    if (!VC.state.seller) return null;
    const channel = VC.supabase
      .channel('seller-scans')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scans',
        filter: `seller_id=eq.${VC.state.seller.id}`
      }, (payload) => {
        const row = payload.new;
        const scan = {
          ...row,
          batchId: row.batch_id,
          ts: new Date(row.scanned_at).getTime(),
          location: row.location_display || 'Unknown',
          device: row.device_type || 'unknown'
        };
        VC.state.scans.unshift(scan);
        callback(scan);
      })
      .subscribe();
    return channel;
  },

  subscribeToFraudAlerts(callback) {
    if (!this.isBackendReady()) return null;
    if (!VC.state.seller) return null;
    return VC.supabase
      .channel('fraud-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fraud_alerts',
        filter: `seller_id=eq.${VC.state.seller.id}`
      }, (payload) => {
        callback(payload.new);
        VC.ui.toast(`⚠ Fraud Alert: ${payload.new.alert_type}`, 'error');
      })
      .subscribe();
  },

  async seedDemo() {
    if (!VC.state.seller) return;
    const existing = await this.getBatches();
    if (existing.length > 0) return;

    const demoBatches = [
      {
        product: 'Kashmiri Saffron Grade A',
        category: 'saffron',
        origin: 'Pampore, Pulwama District, J&K',
        farm: 'Wani Family Farm (Est. 1962)',
        harvest: 'October 2025',
        units: 50,
        cert: 'KVIB-K-2025-7821',
        supplyChain: ['Wani Family Farm - Pampore', 'KVIB Certification Lab', 'Premium Processing Unit', 'Wani Premium Exports']
      },
      {
        product: 'Pashmina Shawl - Hand-woven',
        category: 'pashmina',
        origin: 'Srinagar, Kashmir Valley',
        farm: 'Kashmir Loom Collective',
        harvest: 'August 2025',
        units: 12,
        cert: 'KVIB-P-2025-4432',
        supplyChain: ['Kashmir Loom Collective', 'Hand-spinning artisans - Srinagar', 'Quality Certification Lab', 'Wani Premium Exports']
      }
    ];

    for (const b of demoBatches) {
      await this.createBatch(b);
    }
  }
};
