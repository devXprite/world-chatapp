import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ref, set, onDisconnect, serverTimestamp as serverTimestampRtdb } from 'firebase/database';
import { User } from '../types';
import { db, rtdb } from '../lib/firebase';
import toast from 'react-hot-toast';

const COOKIE_EXPIRY_DAYS = 30;

const getUserAgent = () => encodeURIComponent(navigator.userAgent);

const fetchCountryCode = async () => {
    try {
        const response = await fetch(`https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`);

        if (!response.ok) {
            toast.error('Unable to determine your location. This might be due to browser settings or permissions. Please try again');
            throw new Error('Failed to fetch country info');
        }

        const data: { country: string } = await response.json();
        return data.country as User['country'];
    } catch (error) {
        console.error('Error fetching country code:', error);
        return null;
    }
};

const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isInitializing, setIsInitializing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            if (navigator.cookieEnabled) {
                const savedUserId = Cookies.get('userId');
                const savedName = Cookies.get('userName');

                if (savedUserId && savedName) await checkExistingUser(savedName);
            }
            setIsLoading(false);
        })();
    }, []);

    const updatePresence = (userId: string, userName: string) => {
        try {
            const userStatusRef = ref(rtdb, `userStatus/${userId}`);
            const typingStatusRef = ref(rtdb, `typingStatus/${userId}`);

            set(userStatusRef, {
                name: userName,
                isOnline: true,
                updatedAt: serverTimestampRtdb(),
            });

            onDisconnect(userStatusRef).set({
                name: userName,
                isOnline: false,
                updatedAt: serverTimestampRtdb(),
            });

            onDisconnect(typingStatusRef).set({
                name: userName,
                isTyping: false,
                updatedAt: serverTimestampRtdb(),
            });
        } catch (error) {
            console.error('Error updating presence:', error);
            setError('Failed to update presence status');
        }
    };

    const checkExistingUser = async (name: string): Promise<User | null> => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Checking existing user: ${name}`);
            const userAgent = getUserAgent();
            const userSnap = await getDocs(query(collection(db, 'users'), where('name', '==', name), where('userAgent', '==', userAgent)));

            if (!userSnap.empty) {
                const existingUser = userSnap.docs[0].data() as User;
                const userId = existingUser.id;

                updatePresence(userId, name);
                setUser(existingUser);
                return existingUser;
            }

            return null;
        } catch (error) {
            console.error('Error checking existing user:', error);
            setError('Failed to check existing user');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const initializeUser = async (name: string): Promise<User | null> => {
        setIsInitializing(true);
        setError(null);

        try {
            const existingUser = await checkExistingUser(name);
            if (existingUser) {
                if (navigator.cookieEnabled) {
                    Cookies.set('userId', existingUser.id, { expires: COOKIE_EXPIRY_DAYS });
                    Cookies.set('userName', name, { expires: COOKIE_EXPIRY_DAYS });
                }

                return existingUser;
            }

            const userAgent = getUserAgent();
            const userId = crypto.randomUUID();
            const countryCode = await fetchCountryCode();

            const newUser: User = {
                id: userId,
                name,
                userAgent,
                country: countryCode as User['country'],
                createdAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'users', userId), newUser);
            updatePresence(userId, name);

            if (navigator.cookieEnabled) {
                Cookies.set('userId', userId, { expires: COOKIE_EXPIRY_DAYS });
                Cookies.set('userName', name, { expires: COOKIE_EXPIRY_DAYS });
            }

            setUser(newUser);

            return newUser;
        } catch (error) {
            console.error('Error initializing user:', error);
            setError('Failed to initialize user');
            return null;
        } finally {
            setIsInitializing(false);
        }
    };

    const logout = () => {
        if (navigator.cookieEnabled) {
            Cookies.remove('userId');
            Cookies.remove('userName');
        }
        setUser(null);
    };

    return { user, isLoading, isInitializing, error, initializeUser, logout };
};

export default useAuth;