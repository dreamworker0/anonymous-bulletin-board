import { useEffect, useState, FormEvent } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, User, Clock, AlertCircle } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Message {
  id: string;
  content: string;
  author?: string;
  createdAt: Timestamp | null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages. Please try again later.");
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'messages');
      } catch (e) {
        // Error is logged and thrown by handleFirestoreError, we catch it here to prevent app crash
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const messageData: any = {
        content: newContent.trim(),
        createdAt: serverTimestamp(),
      };
      
      if (newAuthor.trim()) {
        messageData.author = newAuthor.trim();
      }

      await addDoc(collection(db, 'messages'), messageData);
      setNewContent('');
      setNewAuthor('');
    } catch (err) {
      console.error("Error adding message:", err);
      setError("Failed to post message. Please try again.");
      try {
        handleFirestoreError(err, OperationType.CREATE, 'messages');
      } catch (e) {
        // Error is logged and thrown by handleFirestoreError
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <MessageSquare className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">익명 게시판</h1>
          </div>
          <div className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
            로그인 없이 작성 가능
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Compose Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 transition-all focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            <div className="mb-4">
              <label htmlFor="content" className="sr-only">메시지 내용</label>
              <textarea
                id="content"
                rows={3}
                className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-base"
                placeholder="무슨 생각을 하고 계신가요?"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                maxLength={1000}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <User className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0"
                  placeholder="작성자 (선택사항)"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  maxLength={50}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                <span className="text-xs text-gray-400 font-medium">
                  {newContent.length}/1000
                </span>
                <button
                  type="submit"
                  disabled={!newContent.trim() || isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? '등록 중...' : '등록하기'}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Message List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            최신 글 <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{messages.length}</span>
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-sm font-medium text-gray-900">아직 작성된 글이 없습니다</h3>
              <p className="mt-1 text-sm text-gray-500">첫 번째 글을 남겨보세요!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-medium text-gray-900 text-sm">
                        {message.author || '익명'}
                      </span>
                    </div>
                    {message.createdAt && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <time dateTime={message.createdAt.toDate().toISOString()}>
                          {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                        </time>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
