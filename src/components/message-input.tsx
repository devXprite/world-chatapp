import React, { useState } from 'react';
import { Button } from './ui/button';
import { Loader2Icon, Send } from 'lucide-react';
import { Input } from './ui/input';
import { useDebounce } from 'react-use';
import { useAuthContext } from '@/context/auth-context';
import { updateTypingStatus } from '@/lib/chat';

type Props = {
    onSubmit: (e: string) => void;
    isSending: boolean;
};

const MessageInput = ({ onSubmit, isSending }: Props) => {
    const { user } = useAuthContext();
    const [message, setMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    if (!user) return null;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedMessage = message.trim();

        if (isSending || !trimmedMessage) return;

        onSubmit(trimmedMessage);
        updateTypingStatus(false, user);
        setMessage('');
    };

    useDebounce(
        () => {
            if (isTyping) {
                updateTypingStatus(false, user);
                setIsTyping(false);
            }
        },
        1200,
        [message]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);

        if (!isTyping) {
            updateTypingStatus(true, user);
            setIsTyping(true);
        }
    };

    return (
        <div className="p-4 border-t border-border bg-card absolute w-full bottom-0 left-0">
            <div className="absolute w-full top-0 -translate-y-full z-10 h-10 left-0 bg-gradient-to-b from-transparent to-card/70 border-b"></div>

            <form onSubmit={handleSubmit} className="flex gap-2 max-w-screen-md mx-auto group">
                <Input
                    value={message}
                    name="message"
                    placeholder="Write your message here..."
                    className="bg-muted/75"
                    minLength={1}
                    maxLength={250}
                    required
                    disabled={isSending}
                    onChange={handleInputChange}
                />

                <Button
                    size="icon"
                    className="chat-gradient !bg-gradient-to-br !bg-local text-white rounded-lg shrink-0 group-invalid:grayscale group-invalid:cursor-not-allowed transition-all duration-500"
                    disabled={isSending}
                >
                    {isSending ? <Loader2Icon className="size-4 animate-spin" /> : <Send className="size-5" />}
                </Button>
            </form>
        </div>
    );
};

export default MessageInput;
