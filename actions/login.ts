"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        console.log("Attempting login...")
        await signIn("credentials", {
            ...Object.fromEntries(formData),
            redirectTo: "/",
        })
    } catch (error) {
        if ((error as Error).message.includes("NEXT_REDIRECT")) {
            throw error;
        }
        console.log("Login error:", error)
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "Invalid credentials."
                default:
                    return "Something went wrong."
            }
        }
        throw error
    }
}
