
import inquirer from 'inquirer'
import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🛡️  Secure SuperAdmin Creation Utility\n')

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Enter Admin Email:',
            validate: (input) => input.includes('@') || 'Please enter a valid email'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Enter Admin Password:',
            mask: '*',
            validate: (input) => input.length >= 8 || 'Password must be at least 8 characters'
        },
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to create this powerful account?',
            default: false
        }
    ])

    if (!answers.confirm) {
        console.log('❌ Operation cancelled.')
        process.exit(0)
    }

    console.log('\n🔒 Hashing password...')
    const passwordHash = await hash(answers.password, 12)

    console.log('💾 Saving to database...')
    try {
        const user = await prisma.user.upsert({
            where: { email: answers.email },
            update: {
                passwordHash,
                role: 'ADMIN',
                mfaEnabled: false
            },
            create: {
                email: answers.email,
                passwordHash,
                role: 'ADMIN',
                mfaEnabled: false
            }
        })

        console.log(`\n✅ SuperAdmin created successfully!`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Role: ${user.role}`)

        console.log('\n⚠️  IMPORTANT SECURITY NOTICE:')
        console.log('   MFA is currently DISABLED. Please log in immediately and enable MFA via the dashboard.')

    } catch (error) {
        console.error('\n❌ Failed to create user:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
