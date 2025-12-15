import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../config/firebase'

const DYNASTIES_COLLECTION = 'dynasties'

// Get all dynasties for a specific user
export async function getUserDynasties(userId) {
  try {
    const q = query(
      collection(db, DYNASTIES_COLLECTION),
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => {
      const data = doc.data()
      // Remove any 'id' field from data to avoid conflicts with Firestore doc ID
      const { id: _, ...cleanData } = data
      return {
        id: doc.id,  // Always use Firestore document ID
        ...cleanData
      }
    })
  } catch (error) {
    console.error('Error fetching dynasties:', error)
    throw error
  }
}

// Subscribe to real-time updates for user's dynasties
export function subscribeToDynasties(userId, callback) {
  const q = query(
    collection(db, DYNASTIES_COLLECTION),
    where('userId', '==', userId)
  )

  return onSnapshot(q, (snapshot) => {
    const dynasties = snapshot.docs.map(doc => {
      const data = doc.data()
      // Remove any 'id' field from data to avoid conflicts with Firestore doc ID
      const { id: _, ...cleanData } = data
      return {
        id: doc.id,  // Always use Firestore document ID
        ...cleanData
      }
    })
    callback(dynasties)
  }, (error) => {
    console.error('Error in dynasty subscription:', error)
  })
}

// Create a new dynasty
export async function createDynasty(userId, dynastyData) {
  try {
    const docRef = await addDoc(collection(db, DYNASTIES_COLLECTION), {
      ...dynastyData,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    return {
      id: docRef.id,
      ...dynastyData,
      userId
    }
  } catch (error) {
    console.error('Error creating dynasty:', error)
    throw error
  }
}

// Update an existing dynasty
export async function updateDynasty(dynastyId, updates) {
  try {
    const docRef = doc(db, DYNASTIES_COLLECTION, dynastyId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating dynasty:', error)
    throw error
  }
}

// Delete a dynasty
export async function deleteDynasty(dynastyId) {
  try {
    await deleteDoc(doc(db, DYNASTIES_COLLECTION, dynastyId))
  } catch (error) {
    console.error('Error deleting dynasty:', error)
    throw error
  }
}

// Get a single dynasty by ID
export async function getDynasty(dynastyId) {
  try {
    const docRef = doc(db, DYNASTIES_COLLECTION, dynastyId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      // Remove any 'id' field from data to avoid conflicts with Firestore doc ID
      const { id: _, ...cleanData } = data
      return {
        id: docSnap.id,  // Always use Firestore document ID
        ...cleanData
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching dynasty:', error)
    throw error
  }
}

// Migrate localStorage data to Firestore for a user
export async function migrateLocalStorageData(userId) {
  try {
    const localData = localStorage.getItem('cfb-dynasties')
    if (!localData) return []

    const dynasties = JSON.parse(localData)
    const migratedDynasties = []

    for (const dynasty of dynasties) {
      // Remove the old ID and let Firestore generate new ones
      const { id, ...dynastyData } = dynasty
      const newDynasty = await createDynasty(userId, dynastyData)
      migratedDynasties.push(newDynasty)
    }

    // Clear localStorage after successful migration
    localStorage.removeItem('cfb-dynasties')
    console.log(`Migrated ${migratedDynasties.length} dynasties to Firestore`)

    return migratedDynasties
  } catch (error) {
    console.error('Error migrating localStorage data:', error)
    throw error
  }
}
