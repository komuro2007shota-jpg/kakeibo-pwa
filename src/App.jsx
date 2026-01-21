import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { supabase } from './lib/supabase.js';

const categories = [
  '食費',
  '住居',
  '交通',
  '光熱費',
  '通信',
  '日用品',
  '医療',
  '娯楽',
  '教育',
  'その他'
];

const types = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' }
];

const formatYen = (value) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(value || 0);
};

const toMonth = (value) => value?.slice(0, 7) || '';

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    type: 'expense',
    category: categories[0],
    note: ''
  });

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    loadTransactions();
  }, [session]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setStatus(`読み込みエラー: ${error.message}`);
    } else {
      setTransactions(data || []);
      setStatus('');
    }
    setLoading(false);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus('ログインメールを送信しています...');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setStatus(`ログイン失敗: ${error.message}`);
    } else {
      setStatus('メールを確認してログインしてください。');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.date || !form.amount) return;

    const amountValue = Number(form.amount);
    if (Number.isNaN(amountValue)) {
      setStatus('金額が正しくありません');
      return;
    }

    setLoading(true);
    const payload = {
      date: form.date,
      amount: Math.abs(amountValue),
      type: form.type,
      category: form.category,
      note: form.note.trim(),
      user_id: session.user.id
    };

    const { error } = await supabase.from('transactions').insert(payload);
    if (error) {
      setStatus(`保存エラー: ${error.message}`);
    } else {
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
      await loadTransactions();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('この明細を削除しますか？')) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      setStatus(`削除エラー: ${error.message}`);
    } else {
      await loadTransactions();
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return transactions.filter((item) => toMonth(item.date) === month);
  }, [transactions, month]);

  const stats = useMemo(() => {
    const income = filtered
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    const expense = filtered
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map = new Map();
    filtered
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        map.set(item.category, (map.get(item.category) || 0) + item.amount);
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const map = new Map();
    transactions.forEach((item) => {
      const key = toMonth(item.date);
      const current = map.get(key) || { month: key, income: 0, expense: 0 };
      if (item.type === 'income') current.income += item.amount;
      if (item.type === 'expense') current.expense += item.amount;
      map.set(key, current);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({
        ...entry,
        balance: entry.income - entry.expense
      }));
  }, [transactions]);

  if (!session) {
    return (
      <div className="login card">
        <h1>家計簿へようこそ</h1>
        <p className="notice">
          メールアドレスにログインリンクを送ります。リンクを開くとログインできます。
        </p>
        <form onSubmit={handleLogin}>
          <label>
            メールアドレス
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={loading}>
            ログインリンクを送信
          </button>
        </form>
        {status && <p className="notice">{status}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>家計簿</h1>
          <p>今日の支出が、未来の安心になる。</p>
        </div>
        <div>
          <button className="ghost" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="card">
        <form onSubmit={handleSubmit}>
          <label>
            日付
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </label>
          <label>
            金額
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="例: 1200"
              required
            />
          </label>
          <label>
            種別
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {types.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            カテゴリ
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            メモ
            <input
              type="text"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="例: スーパー"
            />
          </label>
          <button type="submit" disabled={loading}>
            登録する
          </button>
        </form>
        {status && <p className="notice">{status}</p>}
      </section>

      <section className="card">
        <div className="grid">
          <div>
            <h2>月別サマリー</h2>
            <p className="notice">月を切り替えて集計を確認できます。</p>
          </div>
          <label>
            対象月
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </div>
        <div className="stats">
          <div className="stat">
            <h3>収入</h3>
            <p>{formatYen(stats.income)}</p>
          </div>
          <div className="stat">
            <h3>支出</h3>
            <p>{formatYen(stats.expense)}</p>
          </div>
          <div className="stat">
            <h3>収支</h3>
            <p>{formatYen(stats.balance)}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>グラフ</h2>
        <div className="charts">
          <div>
            <h3>カテゴリ別支出</h3>
            {categoryData.length === 0 ? (
              <p className="notice">支出がありません。</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1f4d45" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3>月次収支推移</h3>
            {monthlyData.length === 0 ? (
              <p className="notice">データがありません。</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#1f4d45" />
                  <Line type="monotone" dataKey="expense" stroke="#b84a4a" />
                  <Line type="monotone" dataKey="balance" stroke="#3a6c8a" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>明細</h2>
        {loading && <p className="notice">読み込み中...</p>}
        {filtered.length === 0 ? (
          <p className="notice">この月の明細はまだありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>日付</th>
                <th>種別</th>
                <th>カテゴリ</th>
                <th>メモ</th>
                <th>金額</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>
                    <span className="badge">
                      {item.type === 'income' ? '収入' : '支出'}
                    </span>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.note || '-'}</td>
                  <td className={`amount ${item.type === 'income' ? 'positive' : 'negative'}`}>
                    {formatYen(item.amount)}
                  </td>
                  <td>
                    <button className="secondary" onClick={() => handleDelete(item.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
